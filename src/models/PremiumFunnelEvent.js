import mongoose, { Schema } from "mongoose";

const PremiumFunnelEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true, default: null },
    eventType: {
      type: String,
      enum: [
        "upgrade_click",
        "subscription_page_view",
        "purchase_modal_open",
        "purchase_checkout_start",
        "purchase_completed",
      ],
      required: true,
      index: true,
    },
    source: { type: String, trim: true, default: "" },
    path: { type: String, trim: true, default: "" },
    meta: { type: Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

PremiumFunnelEventSchema.index({ eventType: 1, occurredAt: -1 });

const PremiumFunnelEvent =
  mongoose.models.PremiumFunnelEvent || mongoose.model("PremiumFunnelEvent", PremiumFunnelEventSchema);

export default PremiumFunnelEvent;
