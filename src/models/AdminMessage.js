import mongoose, { Schema } from "mongoose";

const AdminMessageSchema = new Schema(
  {
    fromAdminId: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true, index: true },
    toAdminId: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true, index: true },
    message: { type: String, required: true, trim: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AdminMessageSchema.index({ fromAdminId: 1, toAdminId: 1, createdAt: -1 });
AdminMessageSchema.index({ toAdminId: 1, readAt: 1, createdAt: -1 });

const AdminMessage =
  mongoose.models.AdminMessage || mongoose.model("AdminMessage", AdminMessageSchema);

export default AdminMessage;
