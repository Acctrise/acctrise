import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request";
import { hasRole } from "@/lib/auth/roles";
import { getProviderEnvStatuses } from "@/lib/providers/env-status";
import { clearLogsServerCache, getLogsServerDefinitionBySlug, logsServerDefinitions } from "@/lib/providers/logs-servers";
import { connectMongo } from "@/lib/mongodb";
import { Provider } from "@/models/provider";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(user.role, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const liveCheck = request.nextUrl.searchParams.get("live") === "1";

  try {
    const providers = await getProviderEnvStatuses({ liveCheck });

    let servers: Array<{ slug: string; label: string; name: string; enabled: boolean; profitMarginPercent: number }> = [];
    try {
      await connectMongo();
      const documents = await Provider.find({ slug: { $in: logsServerDefinitions.map((definition) => definition.slug) } })
        .select("slug status isHealthy config")
        .lean();
      const bySlug = new Map(documents.map((document) => [document.slug, document]));
      servers = logsServerDefinitions.map((definition) => {
        const document = bySlug.get(definition.slug);
        const config = (document?.config as any) || {};
        return {
          slug: definition.slug,
          label: definition.label,
          name: definition.name,
          enabled: document ? document.status === "ACTIVE" && document.isHealthy !== false : true,
          profitMarginPercent: Number.isFinite(config.profitMarginRate) ? Math.round(config.profitMarginRate * 100) : 50
        };
      });
    } catch (error) {
      console.warn("[admin/providers/status] Could not read logs server state", error);
    }

    return NextResponse.json({
      success: true,
      liveCheck,
      providers,
      servers
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Provider status check failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(user.role, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { slug?: unknown; enabled?: unknown; profitMarginPercent?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug : "";
  const definition = getLogsServerDefinitionBySlug(slug);
  if (!definition) {
    return NextResponse.json({ error: "Unknown logs server." }, { status: 400 });
  }

  if (body.enabled === undefined && body.profitMarginPercent === undefined) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }

  if (body.profitMarginPercent !== undefined) {
    const margin = Number(body.profitMarginPercent);
    if (!Number.isFinite(margin) || margin < 0 || margin > 1000) {
      return NextResponse.json({ error: "Profit margin must be a number between 0 and 1000." }, { status: 400 });
    }
  }

  try {
    await connectMongo();

    // Merge config in application code. Using a dotted $set together with
    // $setOnInsert: { config: {} } conflicts on upsert when no Provider exists
    // yet (before the first Server 2 order), which made margin saves fail.
    const existing = await Provider.findOne({ slug: definition.slug }).lean();
    const mergedConfig: Record<string, any> = { ...((existing?.config as any) || {}) };
    if (body.profitMarginPercent !== undefined) {
      mergedConfig.profitMarginRate = Number(body.profitMarginPercent) / 100;
    }

    const updates: Record<string, any> = {
      name: definition.name,
      slug: definition.slug,
      type: "logs",
      isHealthy: true,
      config: mergedConfig
    };
    if (typeof body.enabled === "boolean") {
      updates.status = body.enabled ? "ACTIVE" : "INACTIVE";
    }

    const document = await Provider.findOneAndUpdate(
      { slug: definition.slug },
      { $set: updates },
      { upsert: true, returnDocument: "after" }
    );

    clearLogsServerCache();

    const config = (document.config as any) || {};
    return NextResponse.json({
      success: true,
      server: {
        slug: definition.slug,
        label: definition.label,
        name: definition.name,
        enabled: document.status === "ACTIVE" && document.isHealthy !== false,
        profitMarginPercent: Number.isFinite(config.profitMarginRate) ? Math.round(config.profitMarginRate * 100) : 50
      }
    });
  } catch (error) {
    console.error("[admin/providers/status] Toggle failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the server." },
      { status: 500 }
    );
  }
}
