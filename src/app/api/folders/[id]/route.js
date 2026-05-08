import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Folder from "@/models/Folder";

export async function GET(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    await connectDB();
    
    const folder = await Folder.findOne({ _id: id, userId: user._id }).populate("fileIds");
    if (!folder) return fail("Folder not found", 404);

    return ok({
      folder: {
        id: folder._id.toString(),
        name: folder.name,
        description: folder.description,
        isPublic: folder.isPublic,
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
    const isPublic = Boolean(body.isPublic);

    if (!name) {
      return fail("Folder name is required", 422);
    }

    if (name.length > 120) {
      return fail("Folder name must be 120 characters or less", 422);
    }

    await connectDB();
    
    const folder = await Folder.findOneAndUpdate(
      { _id: id, userId: user._id },
      {
        $set: {
          name,
          description: description.slice(0, 500),
          isPublic,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!folder) return fail("Folder not found", 404);

    await logActivity(user._id, "folder_updated", `Updated folder: ${name}`);
    return ok({
      folder: {
        id: folder._id.toString(),
        name: folder.name,
        description: folder.description,
        isPublic: folder.isPublic,
        fileCount: folder.fileIds?.length || 0,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
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

    await logActivity(user._id, "folder_deleted", `Deleted folder: ${folder.name}`);
    return ok({ message: "Folder deleted successfully" });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to delete folder", 500);
  }
}
