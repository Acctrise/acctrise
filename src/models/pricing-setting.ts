import mongoose, { type InferSchemaType, type Model, Types } from "mongoose";

const { Schema, model, models } = mongoose;

const pricingSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    numberPricing: {
      standardMarkupPercent: { type: Number, required: true, min: 0, max: 10000 },
      lowCostMarkupPercent: { type: Number, required: true, min: 0, max: 10000 },
      lowCostThresholdUsd: { type: Number, required: true, min: 0 },
      minimumPriceNgn: { type: Number, required: true, min: 0 },
      majorSocialPriceNgn: { type: Number, required: true, min: 0 },
      discordPriceNgn: { type: Number, required: true, min: 0 },
      usaWhatsappPriceNgn: { type: Number, required: true, min: 0 },
      providerMaxPriceUsd: { type: Number, required: true, min: 0 },
      usaWhatsappProviderMaxPriceUsd: { type: Number, required: true, min: 0 }
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

export type PricingSettingDocument = InferSchemaType<typeof pricingSettingSchema> & { _id: Types.ObjectId };
export const PricingSetting = (models.PricingSetting || model("PricingSetting", pricingSettingSchema)) as Model<PricingSettingDocument>;
