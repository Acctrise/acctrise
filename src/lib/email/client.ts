import {
  sendEmail,
  isEmailConfigured,
} from "./templates";

export class EmailError extends Error {
  readonly status: number | null;
  readonly missingVariables: string[];
  readonly body: unknown;

  constructor(
    message: string,
    options: { status?: number | null; missingVariables?: string[]; body?: unknown } = {}
  ) {
    super(message);
    this.name = "EmailError";
    this.status = options.status ?? null;
    this.missingVariables = options.missingVariables ?? [];
    this.body = options.body;
  }
}

export interface BatchRecipient {
  email: string;
  variables?: Record<string, string>;
}

export type BatchStatus = "queued" | "processing" | "paused_limit_reached" | "done" | "failed";

export interface BatchProgress {
  batchId: string;
  status: BatchStatus;
  total: number;
  sent: number;
  failed: number;
}

export function isConfigured(): boolean {
  return isEmailConfigured();
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiRequest<T>(method: "GET" | "POST", path: string, payload?: Record<string, unknown>): Promise<T> {
  const apiKey = process.env.SENDLIBERTY_API_KEY?.trim();
  if (!apiKey) throw new EmailError("SENDLIBERTY_API_KEY is not configured");

  const url = `https://sendliberty.com${path}`;

  for (let attempt = 0; ; attempt += 1) {
    let response: Response;

    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          ...(payload ? { "Content-Type": "application/json" } : {})
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(10_000),
        cache: "no-store"
      });
    } catch (error) {
      throw new EmailError(`Sendliberty request did not complete: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    const raw = await response.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(raw); } catch {}

    if (response.ok) return (parsed ?? {}) as T;

    if (response.status === 429 && attempt === 0) {
      const retryAfter = response.headers.get("retry-after");
      const seconds = Number(retryAfter);
      await delay(Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 5000) : 1000);
      continue;
    }

    const message = (parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).error)
      ? String((parsed as Record<string, unknown>).error)
      : raw.slice(0, 300) || `Sendliberty request failed with status ${response.status}`;
    throw new EmailError(message, { status: response.status, body: parsed ?? raw });
  }
}

export async function submitBatch(input: {
  from: string;
  subject: string;
  html: string;
  recipients: BatchRecipient[];
  replyTo?: string;
}): Promise<{ batchId: string; total: number }> {
  const result = await apiRequest<{ batchId?: string; total?: number }>("POST", "/api/batch", {
    from: input.from,
    subject: input.subject,
    html: input.html,
    recipients: input.recipients,
    ...(input.replyTo ? { replyTo: input.replyTo } : {})
  });

  if (!result.batchId) throw new EmailError("SendLiberty did not return a batch id");

  return { batchId: result.batchId, total: Number(result.total || input.recipients.length) };
}

export async function getBatch(batchId: string): Promise<BatchProgress> {
  const result = await apiRequest<{
    batchId?: string;
    status?: BatchStatus;
    total?: number;
    sent?: number;
    failed?: number;
  }>("GET", `/api/batch/${encodeURIComponent(batchId)}`);

  return {
    batchId: result.batchId || batchId,
    status: result.status || "processing",
    total: Number(result.total || 0),
    sent: Number(result.sent || 0),
    failed: Number(result.failed || 0)
  };
}

export async function sendRaw(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<{ skipped: boolean; reason?: string; messageId: string | null }> {
  if (!isEmailConfigured()) {
    console.log(`[email] skipped raw -> ${maskEmail(input.to)} (not configured)`);
    return { skipped: true, reason: "not-configured", messageId: null };
  }

  try {
    const result = await sendEmail({
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
    });
    return { skipped: false, messageId: result.messageId };
  } catch (error) {
    console.error("[email] sendRaw failed:", error instanceof Error ? error.message : error);
    throw error;
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}