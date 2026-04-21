import mongoose, { Schema } from "mongoose";

const SubscriptionVoucherSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    plan: { type: String, enum: ["pro_monthly", "pro_yearly"], required: true },
    durationDays: { type: Number, required: true, min: 1 },
    maxRedemptions: { type: Number, default: 1, min: 1 },
    redemptionCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, trim: true, default: "" },
    expiresAt: { type: Date, default: null },
    generatedByAdminId: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true, index: true },
    generatedByAdminName: { type: String, trim: true, default: "" },
    redeemedByUserIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
  },
  { timestamps: true }
);

SubscriptionVoucherSchema.index({ isActive: 1, createdAt: -1 });

const SubscriptionVoucher =
  mongoose.models.SubscriptionVoucher || mongoose.model("SubscriptionVoucher", SubscriptionVoucherSchema);

export default SubscriptionVoucher;
