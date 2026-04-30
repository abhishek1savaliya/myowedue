import mongoose, { Schema } from "mongoose";

const StoredFileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, trim: true, default: "" },
    originalName: { type: String, required: true, trim: true },
    mimeType: { type: String, trim: true, default: "" },
    resourceType: { type: String, required: true, trim: true },
    cloudinaryType: { type: String, trim: true, default: "upload" },
    format: { type: String, trim: true, default: "" },
    extension: { type: String, trim: true, default: "" },
    bytes: { type: Number, required: true, min: 0 },
    publicId: { type: String, required: true, trim: true },
    version: { type: Number, default: 0 },
    secureUrl: { type: String, required: true, trim: true },
    thumbnailUrl: { type: String, trim: true, default: "" },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    isPublic: { type: Boolean, default: false, index: true },
    shareToken: { type: String, required: true, trim: true, unique: true, index: true },
  },
  { timestamps: true }
);

StoredFileSchema.index({ userId: 1, createdAt: -1 });
StoredFileSchema.index({ userId: 1, isPublic: 1, createdAt: -1 });
StoredFileSchema.index({ userId: 1, bytes: -1 });

let StoredFile;

if (mongoose.models.StoredFile) {
  StoredFile = mongoose.models.StoredFile;

  const missingPaths = {};
  if (!StoredFile.schema.path("title")) missingPaths.title = { type: String, trim: true, default: "" };
  if (!StoredFile.schema.path("mimeType")) missingPaths.mimeType = { type: String, trim: true, default: "" };
  if (!StoredFile.schema.path("resourceType")) missingPaths.resourceType = { type: String, required: true, trim: true, default: "raw" };
  if (!StoredFile.schema.path("cloudinaryType")) missingPaths.cloudinaryType = { type: String, trim: true, default: "upload" };
  if (!StoredFile.schema.path("format")) missingPaths.format = { type: String, trim: true, default: "" };
  if (!StoredFile.schema.path("extension")) missingPaths.extension = { type: String, trim: true, default: "" };
  if (!StoredFile.schema.path("bytes")) missingPaths.bytes = { type: Number, required: true, min: 0, default: 0 };
  if (!StoredFile.schema.path("publicId")) missingPaths.publicId = { type: String, required: true, trim: true, default: "" };
  if (!StoredFile.schema.path("version")) missingPaths.version = { type: Number, default: 0 };
  if (!StoredFile.schema.path("secureUrl")) missingPaths.secureUrl = { type: String, required: true, trim: true, default: "" };
  if (!StoredFile.schema.path("thumbnailUrl")) missingPaths.thumbnailUrl = { type: String, trim: true, default: "" };
  if (!StoredFile.schema.path("width")) missingPaths.width = { type: Number, default: null };
  if (!StoredFile.schema.path("height")) missingPaths.height = { type: Number, default: null };
  if (!StoredFile.schema.path("isPublic")) missingPaths.isPublic = { type: Boolean, default: false, index: true };
  if (!StoredFile.schema.path("shareToken")) missingPaths.shareToken = { type: String, required: true, trim: true, default: "", unique: true, index: true };

  if (Object.keys(missingPaths).length > 0) {
    StoredFile.schema.add(missingPaths);
  }
} else {
  StoredFile = mongoose.model("StoredFile", StoredFileSchema);
}

export default StoredFile;
