import { connectDB } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Event from "@/models/Event";

/**
 * Parses an ICS date string (YYYYMMDD or YYYYMMDDTHHmmssZ) into a JS Date.
 */
function parseIcsDate(value) {
  if (!value) return null;
  const v = value.trim();
  // Date-only: 20260421 → 2026-04-21T00:00:00Z
  if (/^\d{8}$/.test(v)) {
    return new Date(`${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T00:00:00Z`);
  }
  // Combined UTC: 20260421T090000Z
  if (/^\d{8}T\d{6}Z$/.test(v)) {
    return new Date(
      `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(11, 13)}:${v.slice(13, 15)}Z`
    );
  }
  // Combined local: 20260421T090000
  if (/^\d{8}T\d{6}$/.test(v)) {
    return new Date(
      `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(11, 13)}:${v.slice(13, 15)}`
    );
  }
  return null;
}

/**
 * Parses raw ICS text and returns an array of event-like objects.
 */
function parseIcs(text) {
  // Unfold lines per RFC 5545 (continuation lines start with a space or tab)
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  const events = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT") {
      current = {};
    } else if (line === "END:VEVENT") {
      if (current) {
        events.push(current);
        current = null;
      }
    } else if (current) {
      // Split on first colon, but respect DTSTART;TZID=... style property params
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).toUpperCase();
      const value = line.slice(colonIdx + 1);

      if (key === "SUMMARY") current.title = value.trim();
      else if (key === "DESCRIPTION") current.description = value.trim().replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
      else if (key === "LOCATION") current.location = value.trim();
      else if (key.startsWith("DTSTART")) current.startRaw = value;
      else if (key.startsWith("DTEND")) current.endRaw = value;
      else if (key === "X-MICROSOFT-CDO-ALLDAYEVENT") current.allDayHint = value.trim().toUpperCase() === "TRUE";
    }
  }

  return events.map((e) => {
    const startTime = parseIcsDate(e.startRaw);
    const endTime = parseIcsDate(e.endRaw);
    const allDay = e.allDayHint || (e.startRaw && /^\d{8}$/.test(e.startRaw.trim()));
    return { title: e.title, description: e.description, location: e.location, startTime, endTime, allDay: Boolean(allDay) };
  }).filter((e) => e.title && e.startTime);
}

// POST /api/events/import — accepts an ICS file upload and creates events
export async function POST(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const formData = await request.formData().catch(() => null);
    if (!formData) return fail("Invalid form data", 400);

    const file = formData.get("file");
    if (!file) return fail("No file provided", 400);

    const filename = typeof file.name === "string" ? file.name : "";
    if (!filename.toLowerCase().endsWith(".ics")) return fail("Only .ics files are supported", 400);

    const text = await file.text();
    if (!text.includes("BEGIN:VCALENDAR")) return fail("Invalid ICS file", 400);

    const parsed = parseIcs(text);
    if (!parsed.length) return fail("No valid events found in the file", 400);

    await connectDB();

    const docs = parsed.map((e) => ({
      userId: user._id,
      title: e.title,
      description: e.description || "",
      location: e.location || "",
      startTime: e.startTime,
      endTime: e.endTime || undefined,
      allDay: e.allDay,
    }));

    const inserted = await Event.insertMany(docs, { ordered: false });
    return ok({ imported: inserted.length, events: inserted }, 201);
  } catch (err) {
    console.error("Events import error:", err);
    return fail("Failed to import events", 500);
  }
}
