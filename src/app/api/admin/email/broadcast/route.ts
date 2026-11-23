import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import { hasRole } from "@/lib/auth/roles";
import { clientIp, enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { createBroadcast } from "@/lib/email/broadcast";
import { EmailError } from "@/lib/email/client";

const broadcastSchema = z.object({
  mode: z.enum(["single", "all"]),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  email: z.string().email().optional(),
  ctaLabel: z.string().max(60).optional(),
  ctaUrl: z.string().max(500).optional()
}).refine(
  (value) => value.mode !== "single" || value.email,
  { message: "Email is required when mode is 'single'" }
);

async function requireAdmin(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasRole(user.role, "ADMIN")) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.response) return auth.response;

    const identifier = clientIp(request.headers);
    await enforceRateLimit("admin-broadcast", identifier, 5, 60 * 60 * 1000);

    const input = broadcastSchema.parse(await request.json());

    const doc = await createBroadcast({
      createdBy: auth.user.id,
      mode: input.mode,
      subject: input.subject,
      message: input.message,
      email: input.email,
      ctaLabel: input.ctaLabel,
      ctaUrl: input.ctaUrl
    });

    return NextResponse.json({ success: true, broadcast: { id: doc._id.toString(), status: doc.status } }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    if (error instanceof EmailError) {
      return NextResponse.json({ error: error.message }, { status: error.status === 400 ? 400 : 500 });
    }
    console.error("[admin/email/broadcast]", error);
    return NextResponse.json({ error: "Unable to create broadcast" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || 10), 50);

    const broadcasts = await (await import("@/lib/email/broadcast")).listBroadcasts(limit);
    return NextResponse.json({
      success: true,
      broadcasts: broadcasts.map((doc) => ({
        id: doc._id.toString(),
        mode: doc.mode,
        subject: doc.subject,
        status: doc.status,
        total: doc.total,
        sent: doc.sent,
        failed: doc.failed,
        progress: doc.total > 0 ? Math.round(((doc.sent + doc.failed) / doc.total) * 100) : 0,
        currentChunk: doc.currentChunk,
        createdAt: doc.createdAt
      }))
    });
  } catch (error) {
    console.error("[admin/email/broadcast/list]", error);
    return NextResponse.json({ error: "Unable to load broadcasts" }, { status: 500 });
  }
}