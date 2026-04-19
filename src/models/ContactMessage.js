import mongoose, { Schema } from "mongoose";

const ReplySchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true },
    adminName: { type: String, required: true },
    message: { type: String, required: true, trim: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ContactMessageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
      index: true,
    },
    // Auto-assigned managers & their team members can see this
    assignedManagers: [{ type: Schema.Types.ObjectId, ref: "AdminUser" }],
    // Team member who is handling it
    handledBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
    replies: { type: [ReplySchema], default: [] },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const ContactMessage =
  mongoose.models.ContactMessage ||
  mongoose.model("ContactMessage", ContactMessageSchema);

export default ContactMessage;
