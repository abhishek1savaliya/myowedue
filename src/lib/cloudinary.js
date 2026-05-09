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
    analytics: false,
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
 * Recover full public_id from a delivery URL when DB only has a short id or data is stale.
 * Path pattern: .../upload/[s--sig--/]v123/folder/asset.ext
 */
export function parsePublicIdFromSecureUrl(secureUrl) {
  const raw = String(secureUrl || "").trim();
  if (!raw) return "";
  try {
    const path = new URL(raw).pathname;
    const key = "/upload/";
    const idx = path.indexOf(key);
    if (idx === -1) return "";
    let rest = path.slice(idx + key.length);
    if (rest.startsWith("s--")) {
      const end = rest.indexOf("--/");
      if (end !== -1) rest = rest.slice(end + 3);
    }
    const vm = rest.match(/^v\d+\/(.+)$/);
    if (vm) rest = vm[1];
    const lastDot = rest.lastIndexOf(".");
    if (lastDot > 0) rest = rest.slice(0, lastDot);
    return decodeURIComponent(rest.replace(/\+/g, " "));
  } catch {
    return "";
  }
}

function mergePublicIdHints(file = {}) {
  const fromDb = String(file.publicId || "").trim();
  const fromUrl = parsePublicIdFromSecureUrl(file.secureUrl);
  const out = [];
  if (fromDb) out.push(fromDb);
  if (fromUrl && fromUrl !== fromDb) out.push(fromUrl);
  return [...new Set(out)];
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
      analytics: false,
      urlAnalytics: false,
    };
    if (version > 0) urlOpts.version = version;
    else urlOpts.force_version = false;
    if (format) urlOpts.format = format;
    if (options.longSignature === true) urlOpts.long_url_signature = true;

    return cloudinary.url(publicId, urlOpts);
  } catch {
    return "";
  }
}

/** API-key-signed download URL (api.cloudinary.com) — works when CDN returns 401 for unsigned/signed res.cloudinary.com URLs. */
function buildAuthenticatedDownloadUrl(file) {
  try {
    ensureCloudinaryConfigured();
    const publicId = String(file.publicId || "").trim();
    if (!publicId) return "";

    let format = String(file.format || "").trim();
    if (!format && file.secureUrl) {
      const ext = String(file.secureUrl).match(/\.([a-z0-9]{2,5})(?:\?|#|$)/i);
      if (ext) format = ext[1].toLowerCase();
    }
    if (!format && String(file.mimeType || "").toLowerCase() === "application/pdf") format = "pdf";

    const resourceType = String(file.resourceType || "image").trim() || "image";
    const type = String(file.cloudinaryType || "upload").trim() || "upload";

    return cloudinary.utils.private_download_url(publicId, format, {
      resource_type: resourceType,
      type,
    });
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
  push(buildAuthenticatedDownloadUrl(file));
  push(buildSignedDeliveryUrl(file));
  push(buildSignedDeliveryUrl(file, { longSignature: true }));

  return urls;
}

function promisifyResource(publicId, options) {
  ensureCloudinaryConfigured();
  return new Promise((resolve, reject) => {
    cloudinary.api.resource(
      publicId,
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      },
      options
    );
  });
}

/**
 * Fetch bytes from Cloudinary: try stored URLs + signed variants, then Admin API metadata to reconcile.
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

  async function tryUrlsForFile(f) {
    let last = null;
    for (const url of collectDeliveryUrlCandidates(f)) {
      last = await attempt(url);
      if (last.ok) return last;
    }
    return last;
  }

  const deliveryTypes = [...new Set([String(file.cloudinaryType || "upload").trim() || "upload", "upload"])];
  const resourceTypes = [...new Set([String(file.resourceType || "").trim() || "image", "image", "raw"])];
  const publicIds = mergePublicIdHints(file);

  let lastResponse = null;

  for (const pid of publicIds.length ? publicIds : [""]) {
    if (!pid) continue;
    const slice = { ...file, publicId: pid };
    lastResponse = await tryUrlsForFile(slice);
    if (lastResponse?.ok) return lastResponse;
  }

  if (!publicIds.length) {
    lastResponse = await tryUrlsForFile(file);
    if (lastResponse?.ok) return lastResponse;
  }

  for (const pid of publicIds) {
    for (const rt of resourceTypes) {
      for (const dt of deliveryTypes) {
        try {
          const meta = await promisifyResource(pid, { resource_type: rt, type: dt });
          const reconciled = {
            ...file,
            publicId: meta.public_id || pid,
            resourceType: meta.resource_type || rt,
            format: meta.format || file.format,
            version: Number(meta.version) || Number(file.version) || 0,
            secureUrl: meta.secure_url || file.secureUrl,
            cloudinaryType: meta.type || file.cloudinaryType,
          };
          lastResponse = await tryUrlsForFile(reconciled);
          if (lastResponse?.ok) return lastResponse;
        } catch {
          /* not found for this combo */
        }
      }
    }
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
