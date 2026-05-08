import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { clearUserApiCache } from "@/lib/redis";
import { requireUser } from "@/lib/session";
import Folder, { generateFolderShareToken } from "@/models/Folder";
import FolderPassword from "@/models/FolderPassword";

export async function GET(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    await connectDB();
    
    const folder = await Folder.findOne({ _id: id, userId: user._id }).populate("fileIds");
    if (!folder) return fail("Folder not found", 404);
    if (!folder.shareToken) {
      folder.shareToken = generateFolderShareToken();
      await folder.save();
    }

    return ok({
      folder: {
        id: folder._id.toString(),
        name: folder.name,
        description: folder.description,
        permissionType: folder.permissionType || (folder.isPublic ? "public" : "private"),
        shareToken: folder.shareToken,
        sharePath: folder.shareToken ? `/share/folders/${folder.shareToken}` : "",
        shareUrl: folder.shareToken ? `${new URL(request.url).origin}/share/folders/${folder.shareToken}` : "",
        fileIds: folder.fileIds.map((f) => f._id.toString()),
        fileCount: folder.fileIds?.length || 0,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      },
    });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to get folder", 500);
  }
}

export async function PUT(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const requestedPermission = String(body.permissionType || (body.isPublic ? "public" : "private")).trim();
    const permissionType = ["public", "password", "private"].includes(requestedPermission) ? requestedPermission : "private";

    if (!name) {
      return fail("Folder name is required", 422);
    }

    if (name.length > 120) {
      return fail("Folder name must be 120 characters or less", 422);
    }

    await connectDB();

    const existingFolder = await Folder.findOne({ _id: id, userId: user._id });
    if (!existingFolder) return fail("Folder not found", 404);
    if (!existingFolder.shareToken) existingFolder.shareToken = generateFolderShareToken();
    existingFolder.name = name;
    existingFolder.description = description.slice(0, 500);
    existingFolder.permissionType = permissionType;
    await existingFolder.save();
    
    await logActivity(user._id, "folder_updated", `Updated folder: ${name}`);
    await clearUserApiCache(user._id);
    return ok({
      folder: {
        id: existingFolder._id.toString(),
        name: existingFolder.name,
        description: existingFolder.description,
        permissionType: existingFolder.permissionType,
        shareToken: existingFolder.shareToken,
        sharePath: existingFolder.shareToken ? `/share/folders/${existingFolder.shareToken}` : "",
        shareUrl: existingFolder.shareToken ? `${new URL(request.url).origin}/share/folders/${existingFolder.shareToken}` : "",
        fileIds: (existingFolder.fileIds || []).map((fileId) => fileId.toString()),
        fileCount: existingFolder.fileIds?.length || 0,
        createdAt: existingFolder.createdAt,
        updatedAt: existingFolder.updatedAt,
      },
      message: "Folder updated successfully",
    });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to update folder", 500);
  }
}

export async function DELETE(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    await connectDB();
    
    const folder = await Folder.findOneAndDelete({ _id: id, userId: user._id });
    if (!folder) return fail("Folder not found", 404);

    await Promise.all([
      FolderPassword.deleteMany({ folderId: folder._id }),
      clearUserApiCache(user._id),
      logActivity(user._id, "folder_deleted", `Deleted folder: ${folder.name}`),
    ]);
    return ok({ message: "Folder deleted successfully" });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to delete folder", 500);
  }
}
