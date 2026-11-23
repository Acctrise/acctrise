import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request";
import { hasRole } from "@/lib/auth/roles";
import { connectMongo } from "@/lib/mongodb";
import { Provider } from "@/models/provider";
import { SujanDepartmentAdapter } from "@/lib/providers/adapters/sujandepartment-adapter";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(user.role, "ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await connectMongo();
    const provider = await Provider.findOne({ slug: "sujandepartment" }).lean();
    const config = (provider?.config as any) || {};
    const apiKey = config.apiKey?.trim() || process.env.SUJANDEPARTMENT_API_KEY?.trim();
    const profitMarginRate = Number.isFinite(config.profitMarginRate) ? config.profitMarginRate : 0.5;

    if (!apiKey) {
      return NextResponse.json({ error: "SUJANDEPARTMENT_API_KEY is not configured." }, { status: 400 });
    }

    const adapter = new SujanDepartmentAdapter("sujandepartment", {
      apiKey,
      baseUrl: config.baseUrl || process.env.SUJANDEPARTMENT_BASE_URL,
      timeout: 30000
    });
    const products = await adapter.fetchAdminProducts();

    return NextResponse.json({
      success: true,
      profitMarginPercent: Math.round(profitMarginRate * 100),
      products,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("[admin/logs-server-2/products]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load Sujan Department products." },
      { status: 502 }
    );
  }
}
