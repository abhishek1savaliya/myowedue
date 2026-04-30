import crypto from "crypto";

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || "";

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
  }

  return { cloudName, apiKey, apiSecret };
}

function buildSignature(params, apiSecret) {
  const payload = Object.entries(params)
    .filter(([, value]) => value != null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto.createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}

export function resolveCloudinaryResourceType(mimeType = "") {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.startsWith("image/")) return "image";
  if (normalized === "application/pdf") return "image";
  if (normalized.startsWith("video/")) return "video";
  return "raw";
}

export function createSignedUploadPayload({ userId, filename = "", mimeType = "" }) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const resourceType = resolveCloudinaryResourceType(mimeType);
  const folder = `myowedue/${String(userId)}/vault`;
  const publicId = crypto.randomBytes(18).toString("hex");
  const filenameOverride = String(filename || "file").trim() || "file";
  const params = {
    folder,
    public_id: publicId,
    timestamp,
    filename_override: filenameOverride,
  };

  return {
    cloudName,
    apiKey,
    timestamp,
    folder,
    publicId,
    resourceType,
    signature: buildSignature(params, apiSecret),
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    filenameOverride,
  };
}

export async function destroyCloudinaryAsset({ publicId, resourceType = "raw", cloudinaryType = "upload" }) {
  if (!publicId) return false;

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    public_id: publicId,
    timestamp,
    type: cloudinaryType,
  };

  const formData = new FormData();
  formData.append("public_id", publicId);
  formData.append("timestamp", String(timestamp));
  formData.append("type", cloudinaryType);
  formData.append("api_key", apiKey);
  formData.append("signature", buildSignature(params, apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error?.message || "Failed to remove Cloudinary asset.");
  }

  const data = await response.json().catch(() => ({}));
  return data?.result === "ok" || data?.result === "not found";
}
