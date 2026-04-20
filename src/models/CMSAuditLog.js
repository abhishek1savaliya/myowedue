import mongoose, { Schema } from "mongoose";

const CMSAuditLogSchema = new Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "content_published",
        "submission_created",
        "submission_approved",
        "submission_rejected",
        "permission_granted",
        "permission_revoked",
      ],
      index: true,
    },
    pageKey: {
      type: String,
      enum: ["home", "contact-us", "privacy-policy"],
      default: null,
      index: true,
    },
    actorUserId: { type: Schema.Types.Mixed, required: true, index: true },
    actorRole: {
      type: String,
      enum: ["super_admin", "manager", "team_member", "superadmin", "support"],
      required: true,
      index: true,
    },
    targetUserId: { type: Schema.Types.Mixed, default: null },
    submissionId: { type: Schema.Types.ObjectId, ref: "CMSSubmission", default: null },
    detail: { type: String, default: "" },
    diff: { type: [Schema.Types.Mixed], default: [] },
    previousContent: { type: Schema.Types.Mixed, default: null },
    updatedContent: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

const CMSAuditLog = mongoose.models.CMSAuditLog || mongoose.model("CMSAuditLog", CMSAuditLogSchema);

export default CMSAuditLog;
