import mongoose, { Schema } from "mongoose";

const FolderPasswordSchema = new Schema(
  {
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true, index: true },
    passwordHash: { type: String, required: true }, // Hashed password
    hint: { type: String, trim: true, default: "" }, // Optional password hint
  },
  { timestamps: true }
);

FolderPasswordSchema.index({ folderId: 1 });

let FolderPassword;

if (mongoose.models.FolderPassword) {
  FolderPassword = mongoose.models.FolderPassword;
} else {
  FolderPassword = mongoose.model("FolderPassword", FolderPasswordSchema);
}

export default FolderPassword;
