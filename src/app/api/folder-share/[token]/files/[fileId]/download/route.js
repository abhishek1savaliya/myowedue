import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { fail } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import Folder from "@/models/Folder";
import "@/models/StoredFile";
import { verifyFolderFileDownloadAuth } from "@/lib/folder-share-download-auth";
import { storedFileCloudinaryStreamResponse } from "@/lib/cloudinary-stream-response";

function folderAccessCookieName(token) {
  return `folder_access_${token}`;
}

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { token, fileId } = await params;
    const { searchParams } = new URL(request.url);
    const disposition = searchParams.get("disposition") === "attachment" ? "attachment" : "inline";

    await connectDB();

    const folder = await Folder.findOne({ shareToken: token }).populate("fileIds").lean();
    if (!folder) return fail("Folder not found", 404);

    const file = (folder.fileIds || []).find((item) => String(item._id) === String(fileId));
    if (!file) return fail("File not found in this folder", 404);

    const sessionUser = await getSessionUser(request);
    const isOwner = sessionUser ? String(sessionUser._id) === String(folder.userId) : false;
    const permissionType = folder.permissionType || (folder.isPublic ? "public" : "private");
    const cookieStore = await cookies();
    const hasPasswordAccess = cookieStore.get(folderAccessCookieName(token))?.value === "1";
    const authParam = searchParams.get("auth") || "";
    const hasDownloadAuth =
      permissionType === "password" && verifyFolderFileDownloadAuth(token, fileId, authParam);
    const canOpen =
      isOwner ||
      permissionType === "public" ||
      (permissionType === "password" && (hasPasswordAccess || hasDownloadAuth));

    if (!canOpen) {
      return fail(permissionType === "password" ? "Enter the folder password first." : "This folder is private.", 403);
    }

    const streamed = await storedFileCloudinaryStreamResponse(file, request, { disposition });
    if (!streamed.ok) {
      return fail(streamed.message, streamed.status);
    }
    return streamed.response;
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to open folder file", 500);
  }
}
