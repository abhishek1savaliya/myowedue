import mongoose, { Schema } from "mongoose";

const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    meta: { type: Schema.Types.Mixed, default: {} },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });

const Notification = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);

export default Notification;