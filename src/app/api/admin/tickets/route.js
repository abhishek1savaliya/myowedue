import { connectDB } from "@/lib/db";
import ContactMessage from "@/models/ContactMessage";
import { requireAdmin } from "@/lib/adminSession";
import { ok, fail } from "@/lib/api";

export async function GET(req) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  try {
    await connectDB();

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = 20;

    const filter = {};
    if (status) filter.status = status;

    // Role-based ticket visibility.
    if (admin.role === "support") {
      filter.handledBy = admin._id;
    } else if (admin.role === "manager") {
      filter.assignedManagers = admin._id;
    } else if (admin.role === "superadmin") {
      // Superadmin can view all tickets.
    }

    const [total, tickets] = await Promise.all([
      ContactMessage.countDocuments(filter),
      ContactMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("handledBy", "name email employeeId")
        .populate("assignedManagers", "name email employeeId role")
        .lean(),
    ]);

    return ok({
      tickets: tickets.map((t) => ({
        id: t._id.toString(),
        name: t.name,
        email: t.email,
        message: t.message.substring(0, 120),
        status: t.status,
        handledBy: t.handledBy
          ? { id: t.handledBy._id.toString(), name: t.handledBy.name, employeeId: t.handledBy.employeeId }
          : null,
        assignedManager: t.assignedManagers?.[0]
          ? {
              id: t.assignedManagers[0]._id.toString(),
              name: t.assignedManagers[0].name,
              employeeId: t.assignedManagers[0].employeeId,
            }
          : null,
        repliesCount: t.replies.length,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Admin tickets GET error:", err);
    return fail("Internal server error", 500);
  }
}
