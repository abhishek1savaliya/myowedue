import { connectDB } from "@/lib/db";
import { comparePassword } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { serializeStoredFile } from "@/lib/file-storage";
import { getSessionUser } from "@/lib/session";
import { cookies } from "next/headers";
import Folder from "@/models/Folder";
import FolderPassword from "@/models/FolderPassword";
import FolderAccessEvent from "@/models/FolderAccessEvent";
import { signFolderFileDownloadAuth } from "@/lib/folder-share-download-auth";

function folderAccessCookieName(token) {
  return `folder_access_${token}`;
}

function serializeFolder(folder, origin, token, canViewFiles, isOwner = false) {
  const permissionType = folder.permissionType || (folder.isPublic ? "public" : "private");
  const useDownloadAuth = canViewFiles && permissionType === "password" && !isOwner;
  return {
    id: folder._id.toString(),
    name: folder.name,
    description: folder.description || "",
    permissionType,
    ownerName: folder.userId?.name || "OWE DUE user",
    fileCount: folder.fileIds?.length || 0,
    createdAt: folder.createdAt,
    files: canViewFiles
      ? (folder.fileIds || []).map((file) => {
          const storedFile = serializeStoredFile(file, origin);
          const auth = useDownloadAuth ? `&auth=${encodeURIComponent(signFolderFileDownloadAuth(token, storedFile.id))}` : "";
          return {
            ...storedFile,
            folderOpenUrl: `/api/folder-share/${token}/files/${storedFile.id}/download?disposition=inline${auth}`,
            folderDownloadUrl: `/api/folder-share/${token}/files/${storedFile.id}/download?disposition=attachment${auth}`,
          };
        })
      : [],
  };
}

async function passwordMatches(folderId, candidate) {
  const password = String(candidate || "");
  if (!password) return false;

  const passwords = await FolderPassword.find({ folderId }).select("_id passwordHash").lean();
  for (const item of passwords) {
    if (await comparePassword(password, item.passwordHash)) return item._id?.toString() || true;
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
    const cookieStore = await cookies();
    const hasPasswordAccess = cookieStore.get(folderAccessCookieName(token))?.value === "1";
    const canViewFiles = isOwner || permissionType === "public" || (permissionType === "password" && hasPasswordAccess);

    return ok({
      folder: serializeFolder(folder, new URL(request.url).origin, token, canViewFiles, isOwner),
      access: {
        isOwner,
        canViewFiles,
        requiresPassword: !canViewFiles && !isOwner && permissionType === "password",
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
        folder: serializeFolder(folder, new URL(request.url).origin, token, true, isOwner),
        access: { isOwner, canViewFiles: true, requiresPassword: false, isPrivate: false },
      });
    }

    if (permissionType === "private") {
      return fail("This folder is private.", 403);
    }

    const match = await passwordMatches(folder._id, body.password);
    const matchedPasswordId = typeof match === "string" ? match : "";
    const valid = Boolean(match);

    const forwardedFor = request.headers.get("x-forwarded-for") || "";
    const ip = forwardedFor.split(",")[0].trim() || request.headers.get("x-real-ip") || "";
    const userAgent = request.headers.get("user-agent") || "";

    await FolderAccessEvent.create({
      folderId: folder._id,
      shareToken: token,
      status: valid ? "success" : "failure",
      matchedPasswordId: valid && matchedPasswordId ? matchedPasswordId : null,
      ip: String(ip || "").slice(0, 96),
      userAgent: String(userAgent || "").slice(0, 240),
    }).catch(() => {});

    if (!valid) return fail("Incorrect folder password.", 401);

    const response = ok({
      folder: serializeFolder(folder, new URL(request.url).origin, token, true, isOwner),
      access: { isOwner, canViewFiles: true, requiresPassword: false, isPrivate: false },
    });
    response.cookies.set(folderAccessCookieName(token), "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to verify folder password", 500);
  }
}
