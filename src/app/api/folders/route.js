import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { clearUserApiCache } from "@/lib/redis";
import { requireUser } from "@/lib/session";
import Folder from "@/models/Folder";

export async function GET(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    await connectDB();
    const folders = await Folder.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
    
    const folderData = folders.map((folder) => ({
      id: folder._id.toString(),
      name: folder.name,
      description: folder.description,
      permissionType: folder.permissionType,
      fileCount: folder.fileIds?.length || 0,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    }));

    return ok({ folders: folderData });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to load folders", 500);
  }
}

export async function POST(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();

    if (!name) {
      return fail("Folder name is required", 422);
    }

    if (name.length > 120) {
      return fail("Folder name must be 120 characters or less", 422);
    }

    await connectDB();
    
    const folder = await Folder.create({
      userId: user._id,
      name,
      description: description.slice(0, 500),
      isPublic: false,
      fileIds: [],
    });

    await logActivity(user._id, "folder_created", `Created folder: ${name}`);
    return ok(
      {
        folder: {
          id: folder._id.toString(),
          name: folder.name,
          description: folder.description,
          isPublic: folder.isPublic,
          fileCount: 0,
          createdAt: folder.createdAt,
        },
        message: "Folder created successfully",
      },
      201
    );
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to create folder", 500);
  }
}
