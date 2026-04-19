import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getKey() {
  const raw = process.env.ADMIN_PASSWORD_PREVIEW_KEY || "dev-admin-password-preview-key-change-in-production";
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptAdminPasswordPreview(password) {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(password), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptAdminPasswordPreview(payload) {
  try {
    if (!payload) return "";
    const data = Buffer.from(payload, "base64");
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const encrypted = data.subarray(28);

    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return "";
  }
}
