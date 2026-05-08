import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Folder from "@/models/Folder";
import StoredFile from "@/models/StoredFile";

export async function POST(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const fileId = String(body.fileId || "").trim();

    if (!fileId) {
      return fail("File ID is required", 422);
    }

    await connectDB();

    // Verify folder belongs to user
    const folder = await Folder.findOne({ _id: id, userId: user._id });
    if (!folder) return fail("Folder not found", 404);

    // Verify file belongs to user
    const file = await StoredFile.findOne({ _id: fileId, userId: user._id });
    if (!file) return fail("File not found", 404);

    // Add file to folder if not already present
    if (!folder.fileIds.includes(fileId)) {
      folder.fileIds.push(fileId);
      await folder.save();
      await logActivity(user._id, "file_added_to_folder", `Added file to folder: ${folder.name}`);
    }

    return ok({ message: "File added to folder successfully" }, 200);
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to add file to folder", 500);
  }
}

export async function DELETE(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const fileId = String(body.fileId || "").trim();

    if (!fileId) {
      return fail("File ID is required", 422);
    }

    await connectDB();

    // Verify folder belongs to user
    const folder = await Folder.findOne({ _id: id, userId: user._id });
    if (!folder) return fail("Folder not found", 404);

    // Remove file from folder
    folder.fileIds = folder.fileIds.filter((fId) => fId.toString() !== fileId);
    await folder.save();

    await logActivity(user._id, "file_removed_from_folder", `Removed file from folder: ${folder.name}`);
    return ok({ message: "File removed from folder successfully" });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to remove file from folder", 500);
  }
}
