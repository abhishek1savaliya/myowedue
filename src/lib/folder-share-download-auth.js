import crypto from "crypto";

function secret() {
  return process.env.JWT_SECRET || "dev-secret-change-me";
}

/**
 * HMAC-based token so folder file downloads work when the httpOnly access
 * cookie is not sent (e.g. some mobile / in-app browsers after fetch unlock).
 */
export function signFolderFileDownloadAuth(shareToken, fileId, maxAgeSec = 60 * 60 * 24) {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSec;
  const payload = `${shareToken}:${fileId}:${exp}`;
  const mac = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${exp}.${mac}`;
}

export function verifyFolderFileDownloadAuth(shareToken, fileId, auth) {
  if (!auth || typeof auth !== "string") return false;
  const dot = auth.indexOf(".");
  if (dot <= 0) return false;
  const exp = parseInt(auth.slice(0, dot), 10);
  const mac = auth.slice(dot + 1);
  if (!Number.isFinite(exp) || !mac || exp < Math.floor(Date.now() / 1000)) return false;
  const payload = `${shareToken}:${fileId}:${exp}`;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  if (mac.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(mac, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}
