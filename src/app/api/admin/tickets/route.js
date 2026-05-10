import { connectDB } from "@/lib/db";
import ContactMessage from "@/models/ContactMessage";
import { requireAdmin } from "@/lib/adminSession";
import { ok, fail } from "@/lib/api";
import { getCachedOrCompute } from "@/lib/adminApiCache";

const ADMIN_TICKETS_TTL_MS = 10 * 1000;

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
    /** Default list = actionable pipeline only (exclude resolved/closed/queued). */
    const ACTIVE_PIPELINE = ["open", "in_progress"];

    if (status === "all") {
      // no status constraint
    } else if (status === "completed") {
      filter.status = { $in: ["resolved", "closed"] };
    } else if (status) {
      filter.status = status;
    } else {
      filter.status = { $in: ACTIVE_PIPELINE };
    }

    // Role-based ticket visibility.
    if (admin.role === "support") {
      filter.handledBy = admin._id;
    } else if (admin.role === "manager") {
      filter.assignedManagers = admin._id;
    } else if (admin.role === "superadmin") {
      // Superadmin can view all tickets.
    }

    const cacheKey = `admin:tickets:${admin._id.toString()}:${admin.role}:${status || "default"}:p${page}:l${limit}`;

    const payload = await getCachedOrCompute(cacheKey, ADMIN_TICKETS_TTL_MS, async () => {
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

      return {
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
      };
    });

    return ok(payload);
  } catch (err) {
    console.error("Admin tickets GET error:", err);
    return fail("Internal server error", 500);
  }
}
