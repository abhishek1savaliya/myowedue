export function formatFileBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value;
  let unit = -1;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

function fileCategory(file) {
  const mime = String(file?.mimeType || "").toLowerCase();
  const extension = String(file?.extension || file?.originalName?.split(".").pop() || "").toLowerCase();
  if (mime === "application/pdf" || extension === "pdf") return "pdf";
  if (file?.resourceType === "image" || mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(extension)) {
    return "image";
  }
  if (file?.resourceType === "video" || mime.startsWith("video/") || ["mp4", "webm", "mov", "m4v", "avi"].includes(extension)) {
    return "video";
  }
  return "other";
}

/**
 * @param {{ files: Array; folders: Array; usageBytes: number; quotaBytes: number }} input
 */
export function buildFilesInsights({ files = [], folders = [], usageBytes = 0, quotaBytes = 0 }) {
  const typeCounts = { image: 0, video: 0, pdf: 0, other: 0 };
  const typeBytes = { image: 0, video: 0, pdf: 0, other: 0 };
  let publicCount = 0;

  for (const file of files) {
    const category = fileCategory(file);
    typeCounts[category] += 1;
    typeBytes[category] += Number(file.bytes || 0);
    if (file.isPublic) publicCount += 1;
  }

  const filesInFolderIds = new Set();
  let passwordFolders = 0;
  let publicFolders = 0;

  for (const folder of folders) {
    if (folder.permissionType === "password") passwordFolders += 1;
    if (folder.permissionType === "public") publicFolders += 1;
    for (const id of folder.fileIds || []) {
      filesInFolderIds.add(String(id));
    }
  }

  const topLargest = [...files]
    .sort((a, b) => Number(b.bytes || 0) - Number(a.bytes || 0))
    .slice(0, 3)
    .map((file) => ({
      id: file.id,
      name: file.title || file.originalName || "Untitled",
      bytes: Number(file.bytes || 0),
    }));

  const usagePercent = quotaBytes > 0 ? Math.min(100, Math.round((usageBytes / quotaBytes) * 100)) : 0;
  const dominantType = Object.entries(typeBytes).sort((a, b) => b[1] - a[1])[0]?.[0] || "other";

  return {
    fileCount: files.length,
    folderCount: folders.length,
    usageBytes,
    quotaBytes,
    usagePercent,
    publicCount,
    privateCount: Math.max(0, files.length - publicCount),
    typeCounts,
    typeBytes,
    filesInFolders: filesInFolderIds.size,
    unfiledCount: Math.max(0, files.length - filesInFolderIds.size),
    passwordFolders,
    publicFolders,
    topLargest,
    dominantType,
  };
}
