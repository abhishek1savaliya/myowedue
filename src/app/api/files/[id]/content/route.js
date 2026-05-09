import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { fail } from "@/lib/api";
import { fetchCloudinaryBinary } from "@/lib/cloudinary";
import { requireUser } from "@/lib/session";
import StoredFile from "@/models/StoredFile";

const PASSTHROUGH_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"];

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  try {
    const { id } = await params;
    await connectDB();

    const file = await StoredFile.findOne({ _id: id, userId: user._id }).lean();
    if (!file) return fail("File not found", 404);

    const range = request.headers.get("range");
    const upstream = await fetchCloudinaryBinary(file, {
      range: range || undefined,
    });

    if (!upstream.ok) {
      const status = upstream.status === 404 ? 404 : 502;
      return fail("Could not load file from storage.", status);
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
