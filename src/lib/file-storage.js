import crypto from "crypto";
import StoredFile from "@/models/StoredFile";

export function generateShareToken() {
  return crypto.randomBytes(18).toString("hex");
}

export function fileTitleFromName(filename = "") {
  const value = String(filename || "").trim();
  if (!value) return "Untitled file";
  return value.replace(/\.[^.]+$/, "") || value;
}

export function fileExtensionFromName(filename = "") {
  const match = String(filename || "").trim().match(/\.([^.]+)$/);
  return match ? String(match[1] || "").toLowerCase() : "";
}

export function isPdfFile(file = {}) {
  return String(file?.mimeType || "").toLowerCase() === "application/pdf" || fileExtensionFromName(file?.originalName || file?.secureUrl || "") === "pdf";
}

export function buildPdfFirstPageThumbnailUrl(secureUrl = "") {
  const value = String(secureUrl || "").trim();
  if (!value || !value.includes("/upload/")) return "";
  return value.replace("/upload/", "/upload/f_jpg,pg_1,w_900,c_limit/");
}

export function buildFileThumbnailUrl(file) {
  if (isPdfFile(file)) return file.thumbnailUrl || buildPdfFirstPageThumbnailUrl(file.secureUrl) || "";
  if (file?.resourceType !== "image") return "";
  return file.thumbnailUrl || file.secureUrl || "";
}

export function serializeStoredFile(file, origin = "") {
  const source = typeof file?.toObject === "function" ? file.toObject() : file;
  const id = source?._id?.toString?.() || source?.id || "";
  const sharePath = source?.shareToken ? `/share/files/${source.shareToken}` : "";
  const shareUrl = origin && sharePath ? `${origin}${sharePath}` : sharePath;

  return {
    id,
    title: source?.title || fileTitleFromName(source?.originalName),
    originalName: source?.originalName || "",
    mimeType: source?.mimeType || "",
    resourceType: source?.resourceType || "raw",
    cloudinaryType: source?.cloudinaryType || "upload",
    format: source?.format || "",
    extension: source?.extension || fileExtensionFromName(source?.originalName),
    bytes: Number(source?.bytes || 0),
    isPublic: Boolean(source?.isPublic),
    shareToken: source?.shareToken || "",
    sharePath,
    shareUrl,
    secureUrl: source?.secureUrl || "",
    previewUrl: buildFileThumbnailUrl(source),
    width: source?.width ?? null,
    height: source?.height ?? null,
    createdAt: source?.createdAt || null,
    updatedAt: source?.updatedAt || null,
  };
}

export function serializeFileAccessRequest(request) {
  const source = typeof request?.toObject === "function" ? request.toObject() : request;
  return {
    id: source?._id?.toString?.() || "",
    status: source?.status || "pending",
    respondedAt: source?.respondedAt || null,
    createdAt: source?.createdAt || null,
    requester: source?.requesterUserId
      ? {
          id: source.requesterUserId._id?.toString?.() || "",
          name: source.requesterUserId.name || "User",
          email: source.requesterUserId.email || "",
        }
      : null,
    file: source?.fileId
      ? {
          id: source.fileId._id?.toString?.() || "",
          title: source.fileId.title || fileTitleFromName(source.fileId.originalName),
          originalName: source.fileId.originalName || "",
          bytes: Number(source.fileId.bytes || 0),
          isPublic: Boolean(source.fileId.isPublic),
        }
      : null,
  };
}

export async function getUserStorageUsageBytes(userId) {
  const result = await StoredFile.aggregate([
    { $match: { userId } },
    { $group: { _id: null, totalBytes: { $sum: "$bytes" } } },
  ]);
  return Number(result?.[0]?.totalBytes || 0);
}
