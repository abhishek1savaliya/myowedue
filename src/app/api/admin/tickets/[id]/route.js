import { connectDB } from "@/lib/db";
import ContactMessage from "@/models/ContactMessage";
import AdminUser from "@/models/AdminUser";
import { requireAdmin } from "@/lib/adminSession";
import { ok, fail } from "@/lib/api";

// GET single ticket
export async function GET(req, { params }) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    await connectDB();

    const filter = { _id: id };
    if (admin.role === "support") {
      filter.handledBy = admin._id;
    } else if (admin.role === "manager") {
      filter.assignedManagers = admin._id;
    } else if (admin.role === "superadmin") {
      // Superadmin can access all tickets.
    }

    const ticket = await ContactMessage.findOne(filter)
      .populate("handledBy", "name email employeeId role")
      .populate("assignedManagers", "name email employeeId role")
      .lean();

    if (!ticket) return fail("Ticket not found", 404);

    return ok({ ticket: serializeTicket(ticket) });
  } catch (err) {
    console.error("Admin ticket GET error:", err);
    return fail("Internal server error", 500);
  }
}

// PATCH — update status, assign handler, add reply, add note
export async function PATCH(req, { params }) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    await connectDB();

    const ticket = await ContactMessage.findById(id);
    if (!ticket) return fail("Ticket not found", 404);

    // Access check
    const isManager = admin.role === "manager";
    const isSuperadmin = admin.role === "superadmin";
    const isHandler = ticket.handledBy?.toString() === admin._id.toString();

    if (admin.role === "support" && !isHandler) {
      return fail("Not assigned to this ticket", 403);
    }

    if (isManager && !ticket.assignedManagers.map((x) => x.toString()).includes(admin._id.toString())) {
      return fail("Not assigned to this ticket", 403);
    }

    // Status update
    if (body.status) {
      const allowed = ["open", "in_progress", "resolved", "closed"];
      if (!allowed.includes(body.status)) return fail("Invalid status", 400);
      ticket.status = body.status;
    }

    // Superadmin can reassign ticket to a different manager.
    if (body.assignManager && isSuperadmin) {
      const manager = await AdminUser.findOne({ _id: body.assignManager, role: "manager", isActive: true });
      if (!manager) return fail("Invalid manager selected", 400);
      ticket.assignedManagers = [manager._id];

      // If current handler does not belong to new manager's team, clear handler.
      if (ticket.handledBy) {
        const handler = await AdminUser.findById(ticket.handledBy).select("managerId role");
        const belongsToManager =
          handler &&
          handler.role === "support" &&
          handler.managerId &&
          handler.managerId.toString() === manager._id.toString();
        if (!belongsToManager) {
          ticket.handledBy = null;
        }
      }
    }

    // Assign to a support team member.
    if (body.assignTo && (isManager || isSuperadmin)) {
      const member = await AdminUser.findById(body.assignTo);
      if (!member || !member.isActive || member.role !== "support") {
        return fail("Invalid support member", 400);
      }

      const currentManagerId = ticket.assignedManagers?.[0]?.toString();
      if (!currentManagerId) return fail("Ticket has no assigned manager", 400);

      if (!member.managerId || member.managerId.toString() !== currentManagerId) {
        return fail("Support member is not in the assigned manager's team", 400);
      }

      if (isManager && currentManagerId !== admin._id.toString()) {
        return fail("You can only assign members from your own team", 403);
      }

      ticket.handledBy = member._id;
    }

    // Add reply
    if (body.reply?.trim()) {
      ticket.replies.push({
        adminId: admin._id,
        adminName: admin.name,
        message: body.reply.trim(),
        at: new Date(),
      });
    }

    // Add internal note
    if (typeof body.notes === "string") {
      ticket.notes = body.notes.trim();
    }

    await ticket.save();

    const updated = await ContactMessage.findById(id)
      .populate("handledBy", "name email employeeId role")
      .populate("assignedManagers", "name email employeeId role")
      .lean();

    return ok({ ticket: serializeTicket(updated) });
  } catch (err) {
    console.error("Admin ticket PATCH error:", err);
    return fail("Internal server error", 500);
  }
}

function serializeTicket(t) {
  return {
    id: t._id.toString(),
    name: t.name,
    email: t.email,
    message: t.message,
    status: t.status,
    notes: t.notes,
    handledBy: t.handledBy
      ? { id: t.handledBy._id.toString(), name: t.handledBy.name, employeeId: t.handledBy.employeeId, role: t.handledBy.role }
      : null,
    assignedManagers: (t.assignedManagers || []).map((m) => ({
      id: m._id.toString(),
      name: m.name,
      employeeId: m.employeeId,
      role: m.role,
    })),
    replies: (t.replies || []).map((r) => ({
      adminId: r.adminId?.toString(),
      adminName: r.adminName,
      message: r.message,
      at: r.at,
    })),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
