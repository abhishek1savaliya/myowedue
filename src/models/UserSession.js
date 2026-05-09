import mongoose, { Schema } from "mongoose";

const UserSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sessionId: { type: String, required: true, unique: true, index: true },
    ip: { type: String, trim: true, default: "" },
    userAgent: { type: String, trim: true, default: "" },
    rememberMe: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "revoked"], default: "active", index: true },
    revokedAt: { type: Date, default: null },
    revokeReason: { type: String, trim: true, default: "" },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

UserSessionSchema.index({ userId: 1, status: 1, createdAt: -1 });

let UserSession;

if (mongoose.models.UserSession) {
  UserSession = mongoose.models.UserSession;
} else {
  UserSession = mongoose.model("UserSession", UserSessionSchema);
}

export default UserSession;

