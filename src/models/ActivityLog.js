import mongoose, { Schema } from "mongoose";

const ActivityLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, trim: true },
    detail: { type: String, trim: true },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

const ActivityLog = mongoose.models.ActivityLog || mongoose.model("ActivityLog", ActivityLogSchema);
export default ActivityLog;
