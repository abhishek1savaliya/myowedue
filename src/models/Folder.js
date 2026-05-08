import crypto from "crypto";
import mongoose, { Schema } from "mongoose";

const FolderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    permissionType: { type: String, enum: ["public", "password", "private"], default: "private", index: true }, // public: anyone, password: requires password, private: owner only
    fileIds: [{ type: Schema.Types.ObjectId, ref: "StoredFile" }], // Files in this folder (linked)
    shareToken: { type: String, required: true, trim: true, unique: true, index: true, default: () => crypto.randomBytes(18).toString("hex") },
  },
  { timestamps: true }
);

FolderSchema.index({ userId: 1, createdAt: -1 });
FolderSchema.index({ userId: 1, permissionType: 1 });

let Folder;

if (mongoose.models.Folder) {
  Folder = mongoose.models.Folder;

  const missingPaths = {};
  if (!Folder.schema.path("permissionType")) {
    missingPaths.permissionType = { type: String, enum: ["public", "password", "private"], default: "private", index: true };
  }
  if (!Folder.schema.path("shareToken")) {
    missingPaths.shareToken = { type: String, required: true, trim: true, unique: true, index: true };
  }
  if (Object.keys(missingPaths).length > 0) {
    Folder.schema.add(missingPaths);
  }
} else {
  Folder = mongoose.model("Folder", FolderSchema);
}

export function generateFolderShareToken() {
  return crypto.randomBytes(18).toString("hex");
}

export default Folder;
