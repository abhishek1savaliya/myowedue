import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { fail } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import FileAccessRequest from "@/models/FileAccessRequest";
import StoredFile from "@/models/StoredFile";

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    await connectDB();

    const file = await StoredFile.findOne({ shareToken: token });
    if (!file) return fail("File not found", 404);

    if (file.isPublic) {
      return NextResponse.redirect(file.secureUrl);
    }

    const user = await getSessionUser();
    if (!user) {
      const next = encodeURIComponent(`/share/files/${token}`);
      return NextResponse.redirect(new URL(`/login?next=${next}`, request.url));
    }

    if (String(file.userId) === String(user._id)) {
      return NextResponse.redirect(file.secureUrl);
    }

    const accessRequest = await FileAccessRequest.findOne({
      fileId: file._id,
      requesterUserId: user._id,
      status: "approved",
    }).lean();

    if (!accessRequest) {
      return fail("You do not have access to this file yet.", 403);
    }

    return NextResponse.redirect(file.secureUrl);
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to open file", 500);
  }
}
