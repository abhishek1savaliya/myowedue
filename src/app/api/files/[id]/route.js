import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { destroyCloudinaryAsset } from "@/lib/cloudinary";
import { serializeStoredFile } from "@/lib/file-storage";
import { clearUserApiCache } from "@/lib/redis";
import { requireUser } from "@/lib/session";
import FileAccessRequest from "@/models/FileAccessRequest";
import StoredFile from "@/models/StoredFile";

export async function PATCH(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    await connectDB();

    const file = await StoredFile.findOne({ _id: id, userId: user._id });
    if (!file) return fail("File not found", 404);

    if (typeof body.title === "string") {
      file.title = body.title.trim() || file.title || file.originalName;
    }
    if (typeof body.isPublic === "boolean") {
      file.isPublic = body.isPublic;
    }

    await file.save();
    await clearUserApiCache(user._id);
    await logActivity(user._id, "file_updated", `Updated ${file.originalName}`);

    const origin = new URL(request.url).origin;
    return ok({ file: serializeStoredFile(file, origin), message: "File updated successfully" });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to update file", 422);
  }
}

export async function DELETE(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    await connectDB();

    const file = await StoredFile.findOneAndDelete({ _id: id, userId: user._id });
    if (!file) return fail("File not found", 404);

    await Promise.all([
      FileAccessRequest.deleteMany({ fileId: file._id }),
      destroyCloudinaryAsset(file).catch(() => false),
      clearUserApiCache(user._id),
      logActivity(user._id, "file_deleted", `Deleted ${file.originalName}`),
    ]);

    return ok({ message: "File deleted successfully" });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to delete file", 500);
  }
}
