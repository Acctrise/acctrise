import { appUrl } from "@/lib/auth/app-url";
import { connectMongo } from "@/lib/mongodb";
import { EmailBroadcast, type EmailBroadcastDocument, type EmailBroadcastMode } from "@/models/email-broadcast";
import { User } from "@/models/user";
import { normalizeEmail } from "@/lib/auth/security";
import { EmailError, getBatch, submitBatch, type BatchRecipient } from "./client";
import { sendRaw } from "./send";
import { PRODUCT_NAME, getFrom } from "./templates";

const CHUNK_SIZE = 450;

export interface BroadcastProgress {
  id: string;
  mode: EmailBroadcastMode;
  subject: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  progress: number;
  currentChunk: number;
  chunks: Array<{ status: string; total: number; sent: number; failed: number }>;
  createdAt: Date;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveCtaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return appUrl(trimmed);
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

/**
 * Light HTML on purpose: Sendliberty relays through Gmail, and heavy marketing
 * markup from a personal address lands in spam.
 */
export function buildBroadcastHtml(input: {
  message: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}): string {
  const body = escapeHtml(input.message.trim())
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");

  const ctaUrl = resolveCtaUrl(input.ctaUrl);
  const cta =
    ctaUrl && input.ctaLabel
      ? `<p><a href="${escapeHtml(ctaUrl)}">${escapeHtml(input.ctaLabel.trim())}</a></p>`
      : "";

  return [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#0f172a">`,
    `<p>Hi {{name}},</p>`,
    body,
    cta,
    `<p style="color:#64748b;font-size:12px">You are receiving this because you have a ${PRODUCT_NAME} account. Reply to this email if you need help.</p>`,
    `</div>`
  ].join("");
}

export function serializeBroadcast(doc: EmailBroadcastDocument): BroadcastProgress {
  const chunks = (doc.chunks || []).map((chunk) => ({
    status: chunk.status,
    total: chunk.total || 0,
    sent: chunk.sent || 0,
    failed: chunk.failed || 0
  }));

  const sent = chunks.reduce((sum, chunk) => sum + chunk.sent, 0);
  const failed = chunks.reduce((sum, chunk) => sum + chunk.failed, 0);
  const total = doc.total || 0;

  return {
    id: doc._id.toString(),
    mode: doc.mode,
    subject: doc.subject,
    status: doc.status,
    total,
    sent,
    failed,
    progress: total > 0 ? Math.round(((sent + failed) / total) * 100) : 0,
    currentChunk: doc.currentChunk || 0,
    chunks,
    createdAt: doc.createdAt
  };
}

async function resolveRecipients(input: {
  mode: EmailBroadcastMode;
  email?: string;
  name?: string;
}): Promise<Array<{ email: string; name: string }>> {
  if (input.mode === "single") {
    const email = normalizeEmail(input.email || "");
    if (!email) throw new EmailError("A recipient email is required");

    const user = await User.findOne({ email }).select("email firstName lastName username").lean();
    const name =
      input.name ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      user?.username ||
      email.split("@")[0];

    return [{ email, name }];
  }

  const users = await User.find({ status: "active", emailVerified: { $ne: null } })
    .select("email firstName lastName username")
    .lean();

  const seen = new Set<string>();
  const recipients: Array<{ email: string; name: string }> = [];

  for (const user of users) {
    const email = normalizeEmail(user.email || "");
    if (!email || seen.has(email)) continue;
    seen.add(email);
    recipients.push({
      email,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || email.split("@")[0]
    });
  }

  return recipients;
}

function chunkRecipients(recipients: Array<{ email: string; name: string }>) {
  const chunks: Array<{ emails: string[]; batchId: string | null; status: "pending"; total: number }> = [];

  for (let index = 0; index < recipients.length; index += CHUNK_SIZE) {
    const slice = recipients.slice(index, index + CHUNK_SIZE);
    chunks.push({ emails: slice.map((recipient) => recipient.email), batchId: null, status: "pending", total: slice.length });
  }

  return chunks;
}

async function submitChunk(doc: EmailBroadcastDocument, index: number) {
  const chunk = doc.chunks[index];
  if (!chunk) return;

  const from = getFrom();
  if (!from) throw new EmailError("SENDLIBERTY_FROM is not configured");

  const nameByEmail = new Map((doc.recipients || []).map((recipient) => [recipient.email, recipient.name]));
  const recipients: BatchRecipient[] = chunk.emails.map((email) => ({
    email,
    variables: { name: nameByEmail.get(email) || "there" }
  }));

  const batch = await submitBatch({
    from,
    subject: doc.subject,
    html: buildBroadcastHtml({ message: doc.message, ctaLabel: doc.ctaLabel, ctaUrl: doc.ctaUrl }),
    recipients,
  });

  chunk.batchId = batch.batchId;
  chunk.status = "processing";
  chunk.total = batch.total || recipients.length;
  doc.status = "processing";
  await (doc as any).save();
}

export async function createBroadcast(input: {
  createdBy: string;
  mode: EmailBroadcastMode;
  subject: string;
  message: string;
  email?: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}): Promise<EmailBroadcastDocument> {
  await connectMongo();

  const recipients = await resolveRecipients({ mode: input.mode, email: input.email });
  if (!recipients.length) throw new EmailError("There are no recipients for this broadcast");

  const doc = await EmailBroadcast.create({
    createdBy: input.createdBy,
    mode: input.mode,
    subject: input.subject,
    message: input.message,
    ctaLabel: input.ctaLabel || null,
    ctaUrl: resolveCtaUrl(input.ctaUrl),
    recipients,
    chunks: input.mode === "all" ? chunkRecipients(recipients) : [],
    currentChunk: 0,
    status: "queued",
    total: recipients.length,
    sent: 0,
    failed: 0
  });

  if (input.mode === "single") {
    try {
      const outcome = await sendRaw({
        to: recipients[0].email,
        subject: input.subject,
        html: buildBroadcastHtml({ message: input.message, ctaLabel: input.ctaLabel, ctaUrl: input.ctaUrl }),
      });
      doc.status = outcome.skipped ? "failed" : "done";
      doc.sent = outcome.skipped ? 0 : 1;
    } catch (error) {
      doc.status = "failed";
      doc.failed = 1;
      await doc.save();
      throw error;
    }

    await doc.save();
    return doc;
  }

  try {
    await submitChunk(doc, 0);
  } catch (error) {
    doc.status = "failed";
    await doc.save();
    throw error;
  }

  return doc;
}

/**
 * Polls the active batch and submits the next chunk when it finishes. Safe to
 * call repeatedly: it only moves forward when the current chunk is complete.
 */
export async function advanceBroadcast(id: string): Promise<EmailBroadcastDocument | null> {
  await connectMongo();

  const doc = await EmailBroadcast.findById(id);
  if (!doc) return null;
  if (doc.mode === "single" || doc.status === "done" || doc.status === "failed") return doc;

  const index = doc.currentChunk || 0;
  const chunk = doc.chunks[index];
  if (!chunk) {
    doc.status = "done";
    await doc.save();
    return doc;
  }

  if (!chunk.batchId) {
    await submitChunk(doc, index);
    return doc;
  }

  const progress = await getBatch(chunk.batchId);
  chunk.sent = progress.sent;
  chunk.failed = progress.failed;
  chunk.total = progress.total || chunk.total;

  if (progress.status === "paused_limit_reached") {
    chunk.status = "paused";
    doc.status = "paused";
    await doc.save();
    return doc;
  }

  if (progress.status === "failed") {
    chunk.status = "failed";
    doc.status = "failed";
    await doc.save();
    return doc;
  }

  if (progress.status !== "done") {
    chunk.status = "processing";
    await doc.save();
    return doc;
  }

  chunk.status = "done";

  if (index + 1 < doc.chunks.length) {
    doc.currentChunk = index + 1;
    await submitChunk(doc, index + 1);
    return doc;
  }

  doc.status = "done";
  doc.sent = doc.chunks.reduce((sum, item) => sum + (item.sent || 0), 0);
  doc.failed = doc.chunks.reduce((sum, item) => sum + (item.failed || 0), 0);
  await doc.save();
  return doc;
}

export async function listBroadcasts(limit = 10): Promise<EmailBroadcastDocument[]> {
  await connectMongo();
  return EmailBroadcast.find({}).sort({ createdAt: -1 }).limit(limit);
}
