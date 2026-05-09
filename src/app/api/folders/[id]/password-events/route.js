import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Folder from "@/models/Folder";
import FolderAccessEvent from "@/models/FolderAccessEvent";

export async function GET(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    await connectDB();

    const folder = await Folder.findOne({ _id: id, userId: user._id }).select("_id").lean();
    if (!folder) return fail("Folder not found", 404);

    const events = await FolderAccessEvent.find({ folderId: id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("_id status matchedPasswordId ip userAgent createdAt")
      .lean();

    return ok({
      events: events.map((event) => ({
        id: event._id.toString(),
        status: event.status,
        matchedPasswordId: event.matchedPasswordId ? event.matchedPasswordId.toString() : "",
        ip: event.ip || "",
        userAgent: event.userAgent || "",
        createdAt: event.createdAt,
      })),
    });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to load password events", 500);
  }
}

