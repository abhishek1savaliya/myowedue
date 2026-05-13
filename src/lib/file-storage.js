import crypto from "crypto";
import StoredFile from "@/models/StoredFile";

export * from "./file-storage-utils";

export function generateShareToken() {
  return crypto.randomBytes(18).toString("hex");
}

export async function getUserStorageUsageBytes(userId) {
  const result = await StoredFile.aggregate([
    { $match: { userId } },
    { $group: { _id: null, totalBytes: { $sum: "$bytes" } } },
  ]);
  return Number(result?.[0]?.totalBytes || 0);
}
