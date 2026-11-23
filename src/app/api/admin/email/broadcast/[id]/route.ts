import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request";
import { hasRole } from "@/lib/auth/roles";
import { advanceBroadcast, serializeBroadcast } from "@/lib/email/broadcast";

async function requireAdmin(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasRole(user.role, "ADMIN")) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const doc = await advanceBroadcast(id);
    if (!doc) return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });

    return NextResponse.json({ success: true, broadcast: serializeBroadcast(doc) });
  } catch (error) {
    console.error("[admin/email/broadcast/get]", error);
    return NextResponse.json({ error: "Unable to load broadcast" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const doc = await advanceBroadcast(id);
    if (!doc) return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });

    return NextResponse.json({ success: true, broadcast: serializeBroadcast(doc) });
  } catch (error) {
    console.error("[admin/email/broadcast/resume]", error);
    return NextResponse.json({ error: "Unable to resume broadcast" }, { status: 500 });
  }
}