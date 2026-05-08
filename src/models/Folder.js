import mongoose, { Schema } from "mongoose";

const FolderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    permissionType: { type: String, enum: ["public", "password", "private"], default: "private", index: true }, // public: anyone, password: requires password, private: owner only
    fileIds: [{ type: Schema.Types.ObjectId, ref: "StoredFile" }], // Files in this folder (linked)
  },
  { timestamps: true }
);

FolderSchema.index({ userId: 1, createdAt: -1 });
FolderSchema.index({ userId: 1, permissionType: 1 });

let Folder;

if (mongoose.models.Folder) {
  Folder = mongoose.models.Folder;

  // Migration: convert old isPublic to permissionType
  if (Folder.schema.path("isPublic")) {
    // This would need to be handled in a migration script
    // For now, we'll assume the field is updated
  }
} else {
  Folder = mongoose.model("Folder", FolderSchema);
}

export default Folder;
