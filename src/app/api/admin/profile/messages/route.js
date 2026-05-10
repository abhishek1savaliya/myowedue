import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/adminSession";
import { ok, fail } from "@/lib/api";
import AdminUser from "@/models/AdminUser";
import AdminMessage from "@/models/AdminMessage";
import { maskMessageForSupportViewer, serializeChatMessage } from "@/lib/adminChat";

async function resolveTarget(admin) {
  if (admin.role === "support") {
    return AdminUser.findOne({ role: "superadmin", isActive: true }).sort({ createdAt: 1 }).select("_id").lean();
  }
  if (admin.role === "manager") {
    return AdminUser.findOne({ role: "superadmin", isActive: true }).sort({ createdAt: 1 }).select("_id").lean();
  }
  return null;
}

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  try {
    await connectDB();
    const dbAdmin = await AdminUser.findById(admin._id).lean();
    if (!dbAdmin) return fail("User not found", 404);

    const target = await resolveTarget(dbAdmin);
    if (!target) return ok({ messages: [], target: null });

    const messages = await AdminMessage.find({
      $or: [
        { fromAdminId: dbAdmin._id, toAdminId: target._id },
        { fromAdminId: target._id, toAdminId: dbAdmin._id },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("fromAdminId", "name role employeeId")
      .populate("toAdminId", "name role employeeId")
      .lean();

    const thread = messages
      .reverse()
      .map((m) => maskMessageForSupportViewer(dbAdmin.role, serializeChatMessage(m)));

    return ok({
      targetId: target._id.toString(),
      messages: thread,
    });
  } catch (err) {
    console.error("Admin profile messages GET error:", err);
    return fail("Internal server error", 500);
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  try {
    const { message } = await req.json();
    const trimmed = String(message || "").trim();
    if (!trimmed) return fail("Message is required", 400);

    await connectDB();
    const dbAdmin = await AdminUser.findById(admin._id).lean();
    if (!dbAdmin) return fail("User not found", 404);

    if (dbAdmin.role === "support") {
      return fail("Support cannot send messages here. You can read messages from Admin only.", 403);
    }

    const target = await resolveTarget(dbAdmin);
    if (!target) return fail("No target available for this role", 400);

    const created = await AdminMessage.create({
      fromAdminId: dbAdmin._id,
      toAdminId: target._id,
      message: trimmed,
    });

    const populated = await AdminMessage.findById(created._id)
      .populate("fromAdminId", "name role employeeId")
      .populate("toAdminId", "name role employeeId")
      .lean();

    return ok(
      {
        message: maskMessageForSupportViewer(dbAdmin.role, serializeChatMessage(populated)),
      },
      201
    );
  } catch (err) {
    console.error("Admin profile messages POST error:", err);
    return fail("Internal server error", 500);
  }
}
