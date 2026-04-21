import { connectDB } from "@/lib/db";
import { ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Event from "@/models/Event";

// GET /api/bin/event — list soft-deleted events for the current user
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  await connectDB();
  const events = await Event.find({ userId: user._id, isDeleted: true })
    .sort({ deletedAt: -1 })
    .lean();

  return ok({ events });
}
