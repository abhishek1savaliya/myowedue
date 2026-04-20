import mongoose, { Schema } from "mongoose";

const CMSSubmissionSchema = new Schema(
  {
    pageKey: {
      type: String,
      required: true,
      enum: ["home", "contact-us", "privacy-policy"],
      index: true,
    },
    proposedContent: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    submittedRole: {
      type: String,
      enum: ["super_admin", "manager", "team_member"],
      required: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    feedback: { type: String, default: "" },
    baseVersion: { type: Number, default: 1 },
    diff: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

const CMSSubmission = mongoose.models.CMSSubmission || mongoose.model("CMSSubmission", CMSSubmissionSchema);

export default CMSSubmission;
