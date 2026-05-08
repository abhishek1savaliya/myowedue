import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { clearUserApiCache } from "@/lib/redis";
import { requireUser } from "@/lib/session";
import Folder from "@/models/Folder";
import FolderPassword from "@/models/FolderPassword";

export async function DELETE(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id, passwordId } = await params;
    await connectDB();

    // Verify folder belongs to user
    const folder = await Folder.findOne({ _id: id, userId: user._id });
    if (!folder) return fail("Folder not found", 404);

    const password = await FolderPassword.findOneAndDelete({
      _id: passwordId,
      folderId: id,
    });

    if (!password) return fail("Password not found", 404);

    await Promise.all([
      clearUserApiCache(user._id),
      logActivity(user._id, "folder_password_deleted", `Deleted password from folder: ${folder.name}`),
    ]);

    return ok({ message: "Password deleted successfully" });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to delete password", 500);
  }
}
