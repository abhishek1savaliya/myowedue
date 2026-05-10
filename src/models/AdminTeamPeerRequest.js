import mongoose, { Schema } from "mongoose";

const AdminTeamPeerRequestSchema = new Schema(
  {
    targetUserId: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true, index: true },
    requestedByUserId: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true, index: true },
    kind: { type: String, enum: ["update", "delete"], required: true },
    /** Subset of AdminUser fields to apply on accept (update only). */
    proposedPatch: { type: Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
      index: true,
    },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/** At most one pending request per target superadmin. */
AdminTeamPeerRequestSchema.index(
  { targetUserId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

const AdminTeamPeerRequest =
  mongoose.models.AdminTeamPeerRequest ||
  mongoose.model("AdminTeamPeerRequest", AdminTeamPeerRequestSchema);

export default AdminTeamPeerRequest;
