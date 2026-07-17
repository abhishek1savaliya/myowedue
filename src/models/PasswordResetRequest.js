import mongoose, { Schema } from "mongoose";
import { randomBytes, randomInt, createHash } from "crypto";

export const PASSWORD_RESET_CODE_LENGTH = 6;
export const PASSWORD_RESET_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const PasswordResetRequestSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    status: {
      type: String,
      enum: ["pending", "issued", "used", "cancelled", "expired"],
      default: "pending",
      index: true,
    },
    linkToken: { type: String, default: null, unique: true, sparse: true, index: true },
    codeHash: { type: String, default: null },
    expiresAt: { type: Date, default: null, index: true },
    issuedBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
    issuedAt: { type: Date, default: null },
    usedAt: { type: Date, default: null },
    note: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

PasswordResetRequestSchema.index({ status: 1, createdAt: -1 });

export function hashPasswordResetCode(code) {
  return createHash("sha256").update(String(code).trim()).digest("hex");
}

export function generatePasswordResetCode() {
  const max = 10 ** PASSWORD_RESET_CODE_LENGTH;
  const min = 10 ** (PASSWORD_RESET_CODE_LENGTH - 1);
  return String(randomInt(min, max));
}

export function generatePasswordResetLinkToken() {
  return randomBytes(24).toString("hex");
}

let PasswordResetRequest;

if (mongoose.models.PasswordResetRequest) {
  PasswordResetRequest = mongoose.models.PasswordResetRequest;
} else {
  PasswordResetRequest = mongoose.model("PasswordResetRequest", PasswordResetRequestSchema);
}

export default PasswordResetRequest;
