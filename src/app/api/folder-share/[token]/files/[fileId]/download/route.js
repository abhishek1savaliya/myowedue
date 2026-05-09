import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { fail } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import Folder from "@/models/Folder";

function folderAccessCookieName(token) {
  return `folder_access_${token}`;
}

function withAttachment(url) {
  const value = String(url || "");
  if (!value.includes("/upload/")) return value;
  return value.replace("/upload/", "/upload/fl_attachment/");
}

export async function GET(request, { params }) {
  try {
    const { token, fileId } = await params;
    const { searchParams } = new URL(request.url);
    const disposition = searchParams.get("disposition") === "attachment" ? "attachment" : "inline";

    await connectDB();

    const folder = await Folder.findOne({ shareToken: token }).populate("fileIds");
    if (!folder) return fail("Folder not found", 404);

    const file = (folder.fileIds || []).find((item) => String(item._id) === String(fileId));
    if (!file) return fail("File not found in this folder", 404);

    const sessionUser = await getSessionUser();
    const isOwner = sessionUser ? String(sessionUser._id) === String(folder.userId) : false;
    const permissionType = folder.permissionType || (folder.isPublic ? "public" : "private");
    const cookieStore = await cookies();
    const hasPasswordAccess = cookieStore.get(folderAccessCookieName(token))?.value === "1";
    const canOpen = isOwner || permissionType === "public" || (permissionType === "password" && hasPasswordAccess);

    if (!canOpen) {
      return fail(permissionType === "password" ? "Enter the folder password first." : "This folder is private.", 403);
    }

    const targetUrl = disposition === "attachment" ? withAttachment(file.secureUrl) : file.secureUrl;
    return NextResponse.redirect(targetUrl);
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to open folder file", 500);
  }
}
