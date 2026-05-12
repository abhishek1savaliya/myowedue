import { connectDB } from "@/lib/db";
import ContactMessage from "@/models/ContactMessage";
import AdminUser from "@/models/AdminUser";
import { enqueueEmail } from "@/lib/queue/producers";

/**
 * Assigns a contact ticket (typically status "queued") to the least-loaded active
 * manager team. Returns true if assignment succeeded, false if no manager is active.
 */
export async function tryAssignContactTicket(ticket) {
  const managers = await AdminUser.find({
    role: "manager",
    isActive: true,
  }).select("_id name");

  if (managers.length === 0) return false;

  const managerIds = managers.map((m) => m._id);
  const loadRows = await ContactMessage.aggregate([
    {
      $match: {
        assignedManagers: { $in: managerIds },
        status: { $in: ["open", "in_progress"] },
      },
    },
    { $unwind: "$assignedManagers" },
    { $match: { assignedManagers: { $in: managerIds } } },
    { $group: { _id: "$assignedManagers", count: { $sum: 1 } } },
  ]);

  const loadMap = new Map(loadRows.map((r) => [String(r._id), r.count]));
  let selectedManager = managers[0];
  let minLoad = loadMap.get(String(selectedManager._id)) || 0;
  for (const m of managers) {
    const c = loadMap.get(String(m._id)) || 0;
    if (c < minLoad) {
      minLoad = c;
      selectedManager = m;
    }
  }

  const supports = await AdminUser.find({
    role: "support",
    isActive: true,
    managerId: selectedManager._id,
  }).select("_id");

  let selectedSupportId = null;
  if (supports.length > 0) {
    const supportIds = supports.map((s) => s._id);
    const supportLoadRows = await ContactMessage.aggregate([
      {
        $match: {
          handledBy: { $in: supportIds },
          status: { $in: ["open", "in_progress"] },
        },
      },
      { $group: { _id: "$handledBy", count: { $sum: 1 } } },
    ]);

    const supportLoadMap = new Map(supportLoadRows.map((r) => [String(r._id), r.count]));
    let selectedSupport = supports[0];
    let supportMinLoad = supportLoadMap.get(String(selectedSupport._id)) || 0;
    for (const s of supports) {
      const c = supportLoadMap.get(String(s._id)) || 0;
      if (c < supportMinLoad) {
        supportMinLoad = c;
        selectedSupport = s;
      }
    }
    selectedSupportId = selectedSupport._id;
  }

  ticket.assignedManagers = [selectedManager._id];
  ticket.handledBy = selectedSupportId;
  ticket.status = "open";
  await ticket.save();
  return true;
}

export async function notifyQueuedTicketDelivered(ticket) {
  try {
    await enqueueEmail({
      to: ticket.email,
      subject: "Your message was delivered to our support team",
      headline: "Your message was successfully sent",
      message: `Thanks for contacting us, ${ticket.name}. A member of our team has received your message and will get back to you soon.`,
    });
  } catch {
    // Non-fatal: Resend may be unconfigured or transient failure.
  }
}

/**
 * FIFO: assign queued tickets while at least one manager is active.
 */
export async function processQueuedContactTickets() {
  await connectDB();
  const queued = await ContactMessage.find({ status: "queued" }).sort({ createdAt: 1 }).exec();
  let processed = 0;
  for (const ticket of queued) {
    const assigned = await tryAssignContactTicket(ticket);
    if (!assigned) break;
    processed += 1;
    await notifyQueuedTicketDelivered(ticket);
  }
  return { processed };
}
