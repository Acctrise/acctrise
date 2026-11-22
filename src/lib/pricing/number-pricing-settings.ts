import { connectMongo } from "@/lib/mongodb";
import { PricingSetting } from "@/models/pricing-setting";

export type NumberPricingSettings = {
  standardMarkupPercent: number;
  lowCostMarkupPercent: number;
  lowCostThresholdUsd: number;
  minimumPriceNgn: number;
  majorSocialPriceNgn: number;
  discordPriceNgn: number;
  usaWhatsappPriceNgn: number;
  providerMaxPriceUsd: number;
  usaWhatsappProviderMaxPriceUsd: number;
};

export const DEFAULT_NUMBER_PRICING: NumberPricingSettings = {
  standardMarkupPercent: 54,
  lowCostMarkupPercent: 500.6,
  lowCostThresholdUsd: 0.525,
  minimumPriceNgn: 1200,
  majorSocialPriceNgn: 2500,
  discordPriceNgn: 5000,
  usaWhatsappPriceNgn: 3500,
  providerMaxPriceUsd: 1,
  usaWhatsappProviderMaxPriceUsd: 3.99
};

export async function getNumberPricingSettings(): Promise<NumberPricingSettings> {
  await connectMongo();
  const setting = await PricingSetting.findOne({ key: "number-pricing" }).lean();
  return setting?.numberPricing
    ? { ...DEFAULT_NUMBER_PRICING, ...setting.numberPricing }
    : DEFAULT_NUMBER_PRICING;
}
