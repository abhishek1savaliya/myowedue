import { connectDB } from "@/lib/db";
import { comparePassword } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { serializeStoredFile } from "@/lib/file-storage";
import { getSessionUser } from "@/lib/session";
import Folder from "@/models/Folder";
import FolderPassword from "@/models/FolderPassword";

function serializeFolder(folder, origin, canViewFiles) {
  const permissionType = folder.permissionType || (folder.isPublic ? "public" : "private");
  return {
    id: folder._id.toString(),
    name: folder.name,
    description: folder.description || "",
    permissionType,
    ownerName: folder.userId?.name || "OWE DUE user",
    fileCount: folder.fileIds?.length || 0,
    createdAt: folder.createdAt,
    files: canViewFiles ? (folder.fileIds || []).map((file) => serializeStoredFile(file, origin)) : [],
  };
}

async function passwordMatches(folderId, candidate) {
  const password = String(candidate || "");
  if (!password) return false;

  const passwords = await FolderPassword.find({ folderId }).select("passwordHash").lean();
  for (const item of passwords) {
    if (await comparePassword(password, item.passwordHash)) return true;
  }
  return false;
}

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    await connectDB();

    const folder = await Folder.findOne({ shareToken: token })
      .populate("userId", "name email")
      .populate("fileIds")
      .lean();
    if (!folder) return fail("Folder not found", 404);

    const sessionUser = await getSessionUser();
    const isOwner = sessionUser ? String(sessionUser._id) === String(folder.userId?._id) : false;
    const permissionType = folder.permissionType || (folder.isPublic ? "public" : "private");
    const canViewFiles = isOwner || permissionType === "public";

    return ok({
      folder: serializeFolder(folder, new URL(request.url).origin, canViewFiles),
      access: {
        isOwner,
        canViewFiles,
        requiresPassword: !isOwner && permissionType === "password",
        isPrivate: !isOwner && permissionType === "private",
      },
    });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to load shared folder", 500);
  }
}

export async function POST(request, { params }) {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    await connectDB();

    const folder = await Folder.findOne({ shareToken: token })
      .populate("userId", "name email")
      .populate("fileIds");
    if (!folder) return fail("Folder not found", 404);

    const sessionUser = await getSessionUser();
    const isOwner = sessionUser ? String(sessionUser._id) === String(folder.userId?._id) : false;
    const permissionType = folder.permissionType || (folder.isPublic ? "public" : "private");

    if (isOwner || permissionType === "public") {
      return ok({
        folder: serializeFolder(folder, new URL(request.url).origin, true),
        access: { isOwner, canViewFiles: true, requiresPassword: false, isPrivate: false },
      });
    }

    if (permissionType === "private") {
      return fail("This folder is private.", 403);
    }

    const valid = await passwordMatches(folder._id, body.password);
    if (!valid) return fail("Incorrect folder password.", 401);

    return ok({
      folder: serializeFolder(folder, new URL(request.url).origin, true),
      access: { isOwner, canViewFiles: true, requiresPassword: false, isPrivate: false },
    });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to verify folder password", 500);
  }
}
