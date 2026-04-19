import { connectDB } from "@/lib/db";
import ContactMessage from "@/models/ContactMessage";
import AdminUser from "@/models/AdminUser";
import { ok, fail } from "@/lib/api";

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

    // Auto-assign one active manager
    const managers = await AdminUser.find({
      role: "manager",
      isActive: true,
    }).select("_id name");

    if (managers.length === 0) {
      return fail("No active manager available to receive tickets", 503);
    }

    // Choose manager with the fewest active tickets.
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

    // Auto-assign one active support member from the selected manager's team.
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

    const ticket = await ContactMessage.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim(),
      assignedManagers: [selectedManager._id],
      handledBy: selectedSupportId,
    });

    return ok({ ticketId: ticket._id.toString() }, 201);
  } catch (err) {
    console.error("Contact submit error:", err);
    return fail("Internal server error", 500);
  }
}
