import crypto from "crypto";
import cloudinary from "cloudinary";

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || "";

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
  }

  return { cloudName, apiKey, apiSecret };
}

function ensureCloudinaryConfigured() {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
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

function parseVersionFromSecureUrl(secureUrl) {
  const match = String(secureUrl || "").match(/\/v(\d+)\//);
  return match ? Number(match[1]) : 0;
}

/**
 * Signed delivery URL via official SDK (handles account-specific signing rules).
 */
export function buildSignedDeliveryUrl(file = {}, options = {}) {
  try {
    ensureCloudinaryConfigured();
    const publicId = String(file.publicId || "").trim();
    if (!publicId) return "";

    const resourceType = String(file.resourceType || "image").trim() || "image";
    const type = String(file.cloudinaryType || "upload").trim() || "upload";
    let format = String(file.format || "").trim();
    if (!format && file.secureUrl) {
      const ext = String(file.secureUrl).match(/\.([a-z0-9]{2,5})(?:\?|#|$)/i);
      if (ext) format = ext[1].toLowerCase();
    }

    let version = Number(file.version || 0);
    if (!version) version = parseVersionFromSecureUrl(file.secureUrl);

    const urlOpts = {
      resource_type: resourceType,
      type,
      sign_url: true,
      secure: true,
    };
    if (version > 0) urlOpts.version = version;
    if (format) urlOpts.format = format;
    if (options.longSignature === true) urlOpts.long_url_signature = true;

    return cloudinary.url(publicId, urlOpts);
  } catch {
    return "";
  }
}

function collectDeliveryUrlCandidates(file) {
  const urls = [];
  const push = (u) => {
    const s = String(u || "").trim();
    if (s && !urls.includes(s)) urls.push(s);
  };

  push(file.secureUrl);
  push(buildSignedDeliveryUrl(file));
  push(buildSignedDeliveryUrl(file, { longSignature: true }));

  return urls;
}

/**
 * Fetch bytes from Cloudinary. Tries stored secure URL, then SDK-signed URLs (short + long signature).
 */
export async function fetchCloudinaryBinary(file, requestInit = {}) {
  const { range, headers: inputHeaders, ...rest } = requestInit;
  const headers = new Headers(inputHeaders ?? undefined);
  if (range) headers.set("Range", range);
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", "MyOwedueStorageProxy/1.0");
  }

  const attempt = (url) =>
    fetch(url, {
      redirect: "follow",
      ...rest,
      headers,
    });

  const candidates = collectDeliveryUrlCandidates(file);
  let lastResponse = null;

  for (const url of candidates) {
    lastResponse = await attempt(url);
    if (lastResponse.ok) return lastResponse;
  }

  return lastResponse;
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
