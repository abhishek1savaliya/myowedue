import { NextResponse } from "next/server";
import { fetchCloudinaryBinary } from "@/lib/cloudinary";

const PASSTHROUGH_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"];

function contentDispositionHeader(disposition, originalName, titleFallback = "file") {
  const raw = String(originalName || "").trim() || String(titleFallback || "").trim() || "download";
  const ascii =
    raw
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\;,]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180) || "download";
  const utf8 = encodeURIComponent(raw);
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

/**
 * Stream a StoredFile from Cloudinary through the app (same delivery strategy as
 * authenticated file content). Use for public shares where CDN redirects can 401.
 */
export async function storedFileCloudinaryStreamResponse(file, request, { disposition = "inline" } = {}) {
  const range = request.headers.get("range");
  const upstream = await fetchCloudinaryBinary(file, {
    range: range || undefined,
  });

  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status === 404 ? 404 : 502,
      message: `Could not load file from storage (Cloudinary HTTP ${upstream.status}).`,
    };
  }

  const outHeaders = new Headers();
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) outHeaders.set(name, value);
  }
  if (!outHeaders.has("content-type")) {
    outHeaders.set("Content-Type", file.mimeType || "application/octet-stream");
  }

  const disp = disposition === "attachment" ? "attachment" : "inline";
  outHeaders.set("Content-Disposition", contentDispositionHeader(disp, file.originalName, file.title));
  outHeaders.set("Cache-Control", "private, no-store");
  if (disp === "attachment") {
    outHeaders.set("X-Content-Type-Options", "nosniff");
  }

  return {
    ok: true,
    response: new NextResponse(upstream.body, {
      status: upstream.status,
      headers: outHeaders,
    }),
  };
}
