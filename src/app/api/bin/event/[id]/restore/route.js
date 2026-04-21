import { connectDB } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Event from "@/models/Event";

// POST /api/bin/event/[id]/restore — restore a deleted event
export async function POST(_request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await params;
  await connectDB();

  const event = await Event.findOne({ _id: id, userId: user._id, isDeleted: true });
  if (!event) return fail("Event not found in bin", 404);

  if (event.restoreUntil && event.restoreUntil < new Date()) {
    return fail("Restore window expired", 410);
  }

  event.isDeleted = false;
  event.deletedAt = null;
  event.restoreUntil = null;
  // Reset notification flags so reminders fire again
  event.notifiedAt = { threeDays: false, threeHours: false, oneHour: false };
  await event.save();

  return ok({ event });
}
