import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { destroyCloudinaryAsset } from "@/lib/cloudinary";
import {
  buildPdfFirstPageThumbnailUrl,
  fileExtensionFromName,
  fileTitleFromName,
  generateShareToken,
  isPdfFile,
  getUserStorageUsageBytes,
  serializeFileAccessRequest,
  serializeStoredFile,
} from "@/lib/file-storage";
import { clearUserApiCache, filesCacheKey, getRedisJSON, setRedisJSON } from "@/lib/redis";
import { getStorageQuotaBytes } from "@/lib/subscription";
import { requireUser } from "@/lib/session";
import FileAccessRequest from "@/models/FileAccessRequest";
import StoredFile from "@/models/StoredFile";

const DEFAULT_FILE_LIMIT = 12;
const MAX_FILE_LIMIT = 30;
const MAX_BULK_DELETE = 100;

function parseByteCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

function parseFileLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_FILE_LIMIT;
  return Math.min(MAX_FILE_LIMIT, Math.max(1, Math.round(parsed)));
}

function encodeFileCursor(file) {
  const createdAt = file?.createdAt ? new Date(file.createdAt).toISOString() : "";
  const id = file?._id?.toString?.() || "";
  if (!createdAt || !id) return "";
  return Buffer.from(`${createdAt}|${id}`).toString("base64url");
}

function decodeFileCursor(cursor) {
  try {
    const [createdAt, id] = Buffer.from(String(cursor || ""), "base64url").toString("utf8").split("|");
    const date = new Date(createdAt);
    if (!createdAt || !id || Number.isNaN(date.getTime())) return null;
    return { createdAt: date, id };
  } catch {
    return null;
  }
}

function normalizeFileIds(ids) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map((id) => String(id || "").trim()).filter((id) => /^[a-f\d]{24}$/i.test(id)))].slice(0, MAX_BULK_DELETE);
}

export async function GET(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  await connectDB();

  const { searchParams } = new URL(request.url);
  const limit = parseFileLimit(searchParams.get("limit"));
  const cursor = decodeFileCursor(searchParams.get("cursor"));
  const scope = searchParams.get("scope") || "all";
  const origin = new URL(request.url).origin;
  const cacheKey = filesCacheKey(user._id, searchParams.toString(), origin);
  const cached = await getRedisJSON(cacheKey);
  if (cached) return ok(cached);

  const fileQuery = { userId: user._id };
  if (cursor) {
    fileQuery.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ];
  }

  const files = await StoredFile.find(fileQuery)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const pageFiles = files.slice(0, limit);
  const hasMoreFiles = files.length > limit;

  if (scope === "files") {
    const payload = {
      files: pageFiles.map((file) => serializeStoredFile(file, origin)),
      filesNextCursor: hasMoreFiles ? encodeFileCursor(pageFiles.at(-1)) : "",
      filesHasMore: hasMoreFiles,
    };
    await setRedisJSON(cacheKey, payload, 45);
    return ok(payload);
  }

  const [requests, usageBytes] = await Promise.all([
    FileAccessRequest.find({ ownerUserId: user._id, status: "pending" })
      .sort({ createdAt: -1 })
      .populate("requesterUserId", "name email")
      .populate("fileId", "title originalName bytes isPublic")
      .lean(),
    getUserStorageUsageBytes(user._id),
  ]);

  const payload = {
    files: pageFiles.map((file) => serializeStoredFile(file, origin)),
    filesNextCursor: hasMoreFiles ? encodeFileCursor(pageFiles.at(-1)) : "",
    filesHasMore: hasMoreFiles,
    accessRequests: requests.map((item) => serializeFileAccessRequest(item)),
    usageBytes,
    quotaBytes: getStorageQuotaBytes(user),
    isPremium: Boolean(user.isPremium),
  };
  await setRedisJSON(cacheKey, payload, 45);
  return ok(payload);
}

export async function DELETE(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const ids = normalizeFileIds(body.ids);
    if (ids.length === 0) return fail("Select at least one file to delete.", 422);

    await connectDB();

    const files = await StoredFile.find({ _id: { $in: ids }, userId: user._id });
    if (files.length === 0) return fail("No matching files found.", 404);

    const fileIds = files.map((file) => file._id);
    await StoredFile.deleteMany({ _id: { $in: fileIds }, userId: user._id });

    await Promise.all([
      FileAccessRequest.deleteMany({ fileId: { $in: fileIds } }),
      ...files.map((file) => destroyCloudinaryAsset(file).catch(() => false)),
      clearUserApiCache(user._id),
      logActivity(user._id, "files_deleted", `Deleted ${files.length} files`),
    ]);

    return ok({
      deletedIds: fileIds.map((id) => id.toString()),
      deletedCount: files.length,
      message: files.length === 1 ? "File deleted successfully" : `${files.length} files deleted successfully`,
    });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to delete files", 500);
  }
}

export async function POST(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  let file = null;

  try {
    const body = await request.json().catch(() => ({}));
    const originalName = String(body.originalName || "").trim();
    const secureUrl = String(body.secureUrl || "").trim();
    const publicId = String(body.publicId || "").trim();
    const resourceType = String(body.resourceType || "").trim() || "raw";
    const cloudinaryType = String(body.cloudinaryType || "upload").trim() || "upload";
    const mimeType = String(body.mimeType || "").trim();
    const format = String(body.format || "").trim();
    const title = String(body.title || "").trim() || fileTitleFromName(originalName);
    const bytes = parseByteCount(body.bytes);
    const thumbnailUrl = String(body.thumbnailUrl || "").trim();

    if (!originalName || !secureUrl || !publicId || !bytes) {
      return fail("Missing uploaded file details", 422);
    }

    await connectDB();

    const [usageBytes] = await Promise.all([getUserStorageUsageBytes(user._id)]);
    const quotaBytes = getStorageQuotaBytes(user);
    if (usageBytes + bytes > quotaBytes) {
      await destroyCloudinaryAsset({ publicId, resourceType, cloudinaryType }).catch(() => false);
      return fail("This upload would exceed your storage limit.", 422);
    }

    file = await StoredFile.create({
      userId: user._id,
      title,
      originalName,
      mimeType,
      resourceType,
      cloudinaryType,
      format,
      extension: fileExtensionFromName(originalName),
      bytes,
      publicId,
      version: Number(body.version || 0),
      secureUrl,
      thumbnailUrl: isPdfFile({ mimeType, originalName, secureUrl }) ? buildPdfFirstPageThumbnailUrl(secureUrl) : thumbnailUrl,
      width: body.width == null ? null : Number(body.width),
      height: body.height == null ? null : Number(body.height),
      isPublic: Boolean(body.isPublic),
      shareToken: generateShareToken(),
    });

    await logActivity(user._id, "file_uploaded", `Uploaded ${originalName}`);
    await clearUserApiCache(user._id);

    const origin = new URL(request.url).origin;
    return ok(
      {
        file: serializeStoredFile(file, origin),
        usageBytes: usageBytes + bytes,
        quotaBytes,
        message: "File uploaded successfully",
      },
      201
    );
  } catch (caughtError) {
    if (file?.publicId) {
      await destroyCloudinaryAsset(file).catch(() => false);
    }
    return fail(caughtError?.message || "Failed to save uploaded file", 422);
  }
}
