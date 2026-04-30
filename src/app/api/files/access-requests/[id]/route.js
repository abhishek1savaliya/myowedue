import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { serializeFileAccessRequest } from "@/lib/file-storage";
import { clearUserApiCache } from "@/lib/redis";
import { requireUser } from "@/lib/session";
import FileAccessRequest from "@/models/FileAccessRequest";

export async function PATCH(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const nextStatus = body.status === "approved" ? "approved" : body.status === "rejected" ? "rejected" : "";
    if (!nextStatus) return fail("Choose a valid access decision.", 422);

    await connectDB();

    const accessRequest = await FileAccessRequest.findOne({ _id: id, ownerUserId: user._id })
      .populate("requesterUserId", "name email")
      .populate("fileId", "title originalName bytes isPublic");
    if (!accessRequest) return fail("Access request not found", 404);

    accessRequest.status = nextStatus;
    accessRequest.respondedAt = new Date();
    await accessRequest.save();
    await clearUserApiCache(user._id);

    return ok({
      accessRequest: serializeFileAccessRequest(accessRequest),
      message: nextStatus === "approved" ? "Access approved" : "Access rejected",
    });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to update access request", 500);
  }
}
