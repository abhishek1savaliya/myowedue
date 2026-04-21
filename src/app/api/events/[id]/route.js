import { connectDB } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Event from "@/models/Event";
import { buildBinMeta } from "@/lib/bin";

// PUT /api/events/[id] — update event
export async function PUT(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) return fail("Invalid request body", 400);

    const { title, description, location, startTime, endTime, allDay } = body;
    if (!title?.trim()) return fail("Title is required", 400);
    if (!startTime) return fail("Start time is required", 400);

    const event = await Event.findOneAndUpdate(
      { _id: id, userId: user._id, isDeleted: false },
      {
        title: title.trim(),
        description: description?.trim() || "",
        location: location?.trim() || "",
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : undefined,
        allDay: Boolean(allDay),
        // Reset notification flags if start time changed
        notifiedAt: { threeDays: false, threeHours: false, oneHour: false },
      },
      { returnDocument: "after" }
    );

    if (!event) return fail("Event not found", 404);
    return ok({ event });
  } catch (err) {
    console.error("Events PUT error:", err);
    return fail("Failed to update event", 500);
  }
}

// DELETE /api/events/[id] — soft delete event
export async function DELETE(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const { deletedAt, restoreUntil } = buildBinMeta();
    const event = await Event.findOneAndUpdate(
      { _id: id, userId: user._id, isDeleted: false },
      { isDeleted: true, deletedAt, restoreUntil },
      { returnDocument: "after" }
    );

    if (!event) return fail("Event not found", 404);
    return ok({ message: "Event deleted" });
  } catch (err) {
    console.error("Events DELETE error:", err);
    return fail("Failed to delete event", 500);
  }
}
