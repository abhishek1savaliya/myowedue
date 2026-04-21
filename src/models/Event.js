import mongoose, { Schema } from "mongoose";

const EventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    timezone: { type: String, default: "Australia/Melbourne", trim: true },
    allDay: { type: Boolean, default: false },
    // Tracks which notifications have already been sent to avoid duplicates
    notifiedAt: {
      threeDays: { type: Boolean, default: false },
      threeHours: { type: Boolean, default: false },
      oneHour: { type: Boolean, default: false },
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    restoreUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

EventSchema.index({ userId: 1, startTime: 1 });
EventSchema.index({ userId: 1, isDeleted: 1, startTime: 1 });

const Event = mongoose.models.Event || mongoose.model("Event", EventSchema);
export default Event;
