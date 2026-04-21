import { connectDB } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Event from "@/models/Event";

// GET /api/events — list upcoming (and recent past) events
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    await connectDB();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const events = await Event.find({
      userId: user._id,
      isDeleted: false,
      startTime: { $gte: thirtyDaysAgo },
    })
      .sort({ startTime: 1 })
      .lean();

    return ok({ events });
  } catch (err) {
    console.error("Events GET error:", err);
    return fail("Failed to load events", 500);
  }
}

// POST /api/events — create a new event
export async function POST(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    await connectDB();
    const body = await request.json().catch(() => null);
    if (!body) return fail("Invalid request body", 400);

    const { title, description, location, startTime, endTime, allDay } = body;
    if (!title?.trim()) return fail("Title is required", 400);
    if (!startTime) return fail("Start time is required", 400);

    const event = await Event.create({
      userId: user._id,
      title: title.trim(),
      description: description?.trim() || "",
      location: location?.trim() || "",
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : undefined,
      allDay: Boolean(allDay),
    });

    return ok({ event }, 201);
  } catch (err) {
    console.error("Events POST error:", err);
    return fail("Failed to create event", 500);
  }
}
