import { connectDB } from "@/lib/db";
import ContactMessage from "@/models/ContactMessage";
import { ok, fail } from "@/lib/api";
import { tryAssignContactTicket } from "@/lib/contactTicketAssignment";

export async function POST(req) {
  try {
    const { name, email, message } = await req.json();

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return fail("Name, email, and message are required", 400);
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail("Invalid email address", 400);
    }

    await connectDB();

    const ticket = await ContactMessage.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim(),
      status: "queued",
      assignedManagers: [],
      handledBy: null,
    });

    const assignedNow = await tryAssignContactTicket(ticket);

    return ok(
      {
        ticketId: ticket._id.toString(),
        queued: !assignedNow,
      },
      201
    );
  } catch (err) {
    console.error("Contact submit error:", err);
    return fail("Internal server error", 500);
  }
}
