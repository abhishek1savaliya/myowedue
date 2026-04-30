import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { createSignedUploadPayload } from "@/lib/cloudinary";
import { getUserStorageUsageBytes } from "@/lib/file-storage";
import { getStorageQuotaBytes } from "@/lib/subscription";
import { requireUser } from "@/lib/session";

export async function POST(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const filename = String(body.filename || "").trim();
    const mimeType = String(body.mimeType || "").trim();
    const size = Number(body.size || 0);

    if (!filename || !Number.isFinite(size) || size <= 0) {
      return fail("Choose a valid file before uploading.", 422);
    }

    await connectDB();

    const usageBytes = await getUserStorageUsageBytes(user._id);
    const quotaBytes = getStorageQuotaBytes(user);
    const remainingBytes = Math.max(0, quotaBytes - usageBytes);
    if (size > remainingBytes) {
      return fail("This file is larger than your remaining storage space.", 422);
    }

    return ok({
      ...createSignedUploadPayload({ userId: user._id, filename, mimeType }),
      usageBytes,
      quotaBytes,
      remainingBytes,
    });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to prepare upload", 500);
  }
}
