import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { clearUserApiCache } from "@/lib/redis";
import { requireUser } from "@/lib/session";
import FileAccessRequest from "@/models/FileAccessRequest";
import StoredFile from "@/models/StoredFile";

export async function POST(_request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { token } = await params;
    await connectDB();

    const file = await StoredFile.findOne({ shareToken: token });
    if (!file) return fail("File not found", 404);
    if (String(file.userId) === String(user._id)) {
      return fail("You already own this file.", 422);
    }
    if (file.isPublic) {
      return ok({ status: "approved", message: "This file is already public." });
    }

    const existing = await FileAccessRequest.findOne({
      fileId: file._id,
      requesterUserId: user._id,
    });

    if (existing?.status === "approved") {
      return ok({ status: "approved", message: "You already have access to this file." });
    }
    if (existing?.status === "pending") {
      return ok({ status: "pending", message: "Access request already sent." });
    }

    if (existing) {
      existing.status = "pending";
      existing.respondedAt = null;
      await existing.save();
      await clearUserApiCache(file.userId);
      return ok({ status: "pending", message: "Access request sent again." });
    }

    await FileAccessRequest.create({
      fileId: file._id,
      ownerUserId: file.userId,
      requesterUserId: user._id,
      status: "pending",
    });
    await clearUserApiCache(file.userId);

    return ok({ status: "pending", message: "Access request sent." }, 201);
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to request access", 500);
  }
}
