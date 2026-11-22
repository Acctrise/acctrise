import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import { hasRole } from "@/lib/auth/roles";
import { connectMongo } from "@/lib/mongodb";
import { DEFAULT_NUMBER_PRICING, getNumberPricingSettings } from "@/lib/pricing/number-pricing-settings";
import { PricingSetting } from "@/models/pricing-setting";

const numberPricingSchema = z.object({
  standardMarkupPercent: z.number().min(0).max(10000),
  lowCostMarkupPercent: z.number().min(0).max(10000),
  lowCostThresholdUsd: z.number().min(0).max(1000),
  minimumPriceNgn: z.number().min(0).max(10000000),
  majorSocialPriceNgn: z.number().min(0).max(10000000),
  discordPriceNgn: z.number().min(0).max(10000000),
  usaWhatsappPriceNgn: z.number().min(0).max(10000000),
  providerMaxPriceUsd: z.number().positive().max(1000),
  usaWhatsappProviderMaxPriceUsd: z.number().positive().max(1000)
});

async function requireAdmin(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasRole(user.role, "ADMIN")) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  return NextResponse.json({ success: true, numberPricing: await getNumberPricingSettings(), defaults: DEFAULT_NUMBER_PRICING });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const parsed = numberPricingSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid pricing settings." }, { status: 400 });
  }

  await connectMongo();
  const setting = await PricingSetting.findOneAndUpdate(
    { key: "number-pricing" },
    { $set: { numberPricing: parsed.data, updatedBy: auth.user?.id || null } },
    { upsert: true, returnDocument: "after", runValidators: true }
  ).lean();

  return NextResponse.json({ success: true, numberPricing: setting!.numberPricing });
}
