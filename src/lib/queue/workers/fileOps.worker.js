import { destroyCloudinaryAsset } from "@/lib/cloudinary";

export const FILEOPS_QUEUE_NAME = "file-ops";
export const FILEOPS_CONCURRENCY = 3;

export async function fileOpsProcessor(job) {
  if (job.name !== "bulk-delete-cloudinary") {
    throw new Error(`Unknown file-ops job: ${job.name}`);
  }

  const { files } = job.data;
  if (!Array.isArray(files) || files.length === 0) return { deleted: 0 };

  let deleted = 0;
  let failed = 0;

  for (const file of files) {
    try {
      await destroyCloudinaryAsset(file);
      deleted++;
    } catch {
      failed++;
    }
  }

  return { deleted, failed, total: files.length };
}
