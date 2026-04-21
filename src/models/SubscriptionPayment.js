import mongoose, { Schema } from "mongoose";

const SubscriptionPaymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    eventType: {
      type: String,
      enum: ["purchase", "renewal", "auto_payment_deducted", "voucher_applied", "cancelled"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["completed", "cancelled", "failed", "pending"], default: "completed" },
    amount: { type: Number, default: 0 },
    currency: { type: String, trim: true, default: "USD" },
    billingCycle: { type: String, enum: ["monthly", "yearly", "voucher", "manual", "none"], default: "none" },
    meta: { type: Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

SubscriptionPaymentSchema.index({ userId: 1, occurredAt: -1 });

const SubscriptionPayment =
  mongoose.models.SubscriptionPayment || mongoose.model("SubscriptionPayment", SubscriptionPaymentSchema);

export default SubscriptionPayment;
