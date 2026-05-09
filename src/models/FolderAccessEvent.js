import mongoose, { Schema } from "mongoose";

const FolderAccessEventSchema = new Schema(
  {
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true, index: true },
    shareToken: { type: String, trim: true, default: "", index: true },
    status: { type: String, enum: ["success", "failure"], required: true, index: true },
    matchedPasswordId: { type: Schema.Types.ObjectId, ref: "FolderPassword", default: null, index: true },
    ip: { type: String, trim: true, default: "" },
    userAgent: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

FolderAccessEventSchema.index({ folderId: 1, createdAt: -1 });
FolderAccessEventSchema.index({ shareToken: 1, createdAt: -1 });

let FolderAccessEvent;

if (mongoose.models.FolderAccessEvent) {
  FolderAccessEvent = mongoose.models.FolderAccessEvent;
} else {
  FolderAccessEvent = mongoose.model("FolderAccessEvent", FolderAccessEventSchema);
}

export default FolderAccessEvent;

