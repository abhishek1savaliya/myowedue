import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { clearUserApiCache } from "@/lib/redis";
import { requireUser } from "@/lib/session";
import Folder, { generateFolderShareToken } from "@/models/Folder";

export async function GET(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    await connectDB();
    const folders = await Folder.find({ userId: user._id }).sort({ createdAt: -1 });
    await Promise.all(
      folders
        .filter((folder) => !folder.shareToken)
        .map((folder) => {
          folder.shareToken = generateFolderShareToken();
          return folder.save();
        })
    );
    
    const folderData = folders.map((folder) => ({
      id: folder._id.toString(),
      name: folder.name,
      description: folder.description,
      permissionType: folder.permissionType,
      shareToken: folder.shareToken,
      sharePath: folder.shareToken ? `/share/folders/${folder.shareToken}` : "",
      shareUrl: folder.shareToken ? `${new URL(request.url).origin}/share/folders/${folder.shareToken}` : "",
      fileIds: (folder.fileIds || []).map((id) => id.toString()),
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
      permissionType: "private",
      fileIds: [],
      shareToken: generateFolderShareToken(),
    });

    await logActivity(user._id, "folder_created", `Created folder: ${name}`);
    await clearUserApiCache(user._id);
    return ok(
      {
        folder: {
          id: folder._id.toString(),
          name: folder.name,
          description: folder.description,
          permissionType: folder.permissionType,
          shareToken: folder.shareToken,
          sharePath: `/share/folders/${folder.shareToken}`,
          shareUrl: `${new URL(request.url).origin}/share/folders/${folder.shareToken}`,
          fileIds: [],
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
