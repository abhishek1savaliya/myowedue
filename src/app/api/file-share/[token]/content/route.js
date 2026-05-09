import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { fail } from "@/lib/api";
import { fetchCloudinaryBinary } from "@/lib/cloudinary";
import { getSessionUser } from "@/lib/session";
import FileAccessRequest from "@/models/FileAccessRequest";
import StoredFile from "@/models/StoredFile";

const PASSTHROUGH_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"];

async function assertCanReadFile(file, token, request) {
  if (file.isPublic) return { ok: true, user: null };

  const user = await getSessionUser(request);
  if (!user) {
    const next = encodeURIComponent(`/share/files/${token}`);
    return { ok: false, redirect: NextResponse.redirect(new URL(`/login?next=${next}`, request.url)) };
  }

  if (String(file.userId) === String(user._id)) return { ok: true, user };

  const accessRequest = await FileAccessRequest.findOne({
    fileId: file._id,
    requesterUserId: user._id,
    status: "approved",
  }).lean();

  if (!accessRequest) return { ok: false, error: fail("You do not have access to this file yet.", 403) };

  return { ok: true, user };
}

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    await connectDB();

    const file = await StoredFile.findOne({ shareToken: token });
    if (!file) return fail("File not found", 404);

    const access = await assertCanReadFile(file, token, request);
    if (!access.ok) return access.redirect || access.error;

    const range = request.headers.get("range");
    const upstream = await fetchCloudinaryBinary(file, {
      range: range || undefined,
    });

    if (!upstream.ok) {
      const status = upstream.status === 404 ? 404 : 502;
      return fail(`Could not load file from storage (Cloudinary HTTP ${upstream.status}).`, status);
    }

    const outHeaders = new Headers();
    for (const name of PASSTHROUGH_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) outHeaders.set(name, value);
    }
    if (!outHeaders.has("content-type")) {
      outHeaders.set("Content-Type", file.mimeType || "application/octet-stream");
    }
    outHeaders.set("Cache-Control", "private, no-store");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: outHeaders,
    });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to stream file", 500);
  }
}
