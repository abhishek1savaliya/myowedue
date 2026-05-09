import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { buildFileThumbnailUrl, isPdfFile } from "@/lib/file-storage";
import { getSessionUser } from "@/lib/session";
import FileAccessRequest from "@/models/FileAccessRequest";
import StoredFile from "@/models/StoredFile";

function buildPublicFilePayload(file) {
  return {
    title: file.title || file.originalName,
    originalName: file.originalName,
    mimeType: file.mimeType || "",
    resourceType: file.resourceType || "raw",
    bytes: Number(file.bytes || 0),
    isPublic: Boolean(file.isPublic),
    createdAt: file.createdAt || null,
    ownerName: file.userId?.name || "OWE DUE user",
    previewUrl: file.isPublic && (file.resourceType === "image" || isPdfFile(file)) ? buildFileThumbnailUrl(file) : "",
    mediaUrl: file.isPublic && ["image", "video"].includes(file.resourceType) ? file.secureUrl || "" : "",
  };
}

export async function GET(_request, { params }) {
  try {
    const { token } = await params;
    await connectDB();

    const file = await StoredFile.findOne({ shareToken: token }).populate("userId", "name email");
    if (!file) return fail("File not found", 404);

    const sessionUser = await getSessionUser();
    const isOwner = sessionUser ? String(sessionUser._id) === String(file.userId?._id) : false;
    let requestStatus = "none";
    let canDownload = Boolean(file.isPublic || isOwner);

    if (!canDownload && sessionUser) {
      const accessRequest = await FileAccessRequest.findOne({
        fileId: file._id,
        requesterUserId: sessionUser._id,
      }).lean();
      requestStatus = accessRequest?.status || "none";
      canDownload = accessRequest?.status === "approved";
    }

    if (!sessionUser && !file.isPublic) {
      requestStatus = "login_required";
    }

    const publicFile = buildPublicFilePayload(file);
    if (canDownload && (file.resourceType === "image" || isPdfFile(file))) {
      publicFile.previewUrl = buildFileThumbnailUrl(file);
    }
    if (canDownload && ["image", "video"].includes(file.resourceType)) {
      publicFile.mediaUrl = file.secureUrl || "";
    }

    return ok({
      file: publicFile,
      access: {
        isAuthenticated: Boolean(sessionUser),
        isOwner,
        canDownload,
        canRequestAccess: Boolean(sessionUser) && !isOwner && !file.isPublic && requestStatus !== "approved" && requestStatus !== "pending",
        requestStatus,
        downloadUrl: canDownload ? `/api/file-share/${token}/download` : "",
      },
    });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to load shared file", 500);
  }
}
