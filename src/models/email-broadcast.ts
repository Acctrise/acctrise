import { Schema, model, models, type InferSchemaType, type Model, Types } from "mongoose";

export const emailBroadcastModes = ["single", "all"] as const;
export const emailBroadcastStatuses = ["queued", "processing", "paused", "done", "failed"] as const;
export const emailBroadcastChunkStatuses = ["pending", "processing", "paused", "done", "failed"] as const;

export type EmailBroadcastMode = (typeof emailBroadcastModes)[number];
export type EmailBroadcastStatus = (typeof emailBroadcastStatuses)[number];

const recipientSchema = new Schema(
  {
    email: { type: String, required: true },
    name: { type: String, default: "" }
  },
  { _id: false }
);

const chunkSchema = new Schema(
  {
    emails: { type: [String], default: [] },
    batchId: { type: String, default: null },
    status: { type: String, enum: emailBroadcastChunkStatuses, default: "pending" },
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  { _id: false }
);

const emailBroadcastSchema = new Schema(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mode: { type: String, enum: emailBroadcastModes, required: true },
    subject: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 5000 },
    ctaLabel: { type: String, default: null, maxlength: 60 },
    ctaUrl: { type: String, default: null, maxlength: 500 },
    recipients: { type: [recipientSchema], default: [] },
    chunks: { type: [chunkSchema], default: [] },
    currentChunk: { type: Number, default: 0 },
    status: { type: String, enum: emailBroadcastStatuses, default: "queued", index: true },
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  { timestamps: true }
);

emailBroadcastSchema.index({ createdAt: -1 });

export type EmailBroadcastDocument = InferSchemaType<typeof emailBroadcastSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
} & import("mongoose").Document;

export const EmailBroadcast = (
  models.EmailBroadcast || model("EmailBroadcast", emailBroadcastSchema)
) as Model<EmailBroadcastDocument>;
