import mongoose, { Schema } from "mongoose";

const FileAccessRequestSchema = new Schema(
  {
    fileId: { type: Schema.Types.ObjectId, ref: "StoredFile", required: true, index: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requesterUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

FileAccessRequestSchema.index({ fileId: 1, requesterUserId: 1 }, { unique: true });
FileAccessRequestSchema.index({ ownerUserId: 1, status: 1, createdAt: -1 });

let FileAccessRequest;

if (mongoose.models.FileAccessRequest) {
  FileAccessRequest = mongoose.models.FileAccessRequest;

  const missingPaths = {};
  if (!FileAccessRequest.schema.path("status")) {
    missingPaths.status = { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true };
  }
  if (!FileAccessRequest.schema.path("respondedAt")) missingPaths.respondedAt = { type: Date, default: null };

  if (Object.keys(missingPaths).length > 0) {
    FileAccessRequest.schema.add(missingPaths);
  }
} else {
  FileAccessRequest = mongoose.model("FileAccessRequest", FileAccessRequestSchema);
}

export default FileAccessRequest;
