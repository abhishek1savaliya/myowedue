import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/adminSession";
import { ok, fail } from "@/lib/api";
import AdminUser from "@/models/AdminUser";
import { listChatRecipientsForAdmin, serializeRecipientForViewer } from "@/lib/adminChat";

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  try {
    await connectDB();
    const dbAdmin = await AdminUser.findById(admin._id).lean();
    if (!dbAdmin) return fail("User not found", 404);

    const rows = await listChatRecipientsForAdmin(dbAdmin);
    return ok({ recipients: rows.map((u) => serializeRecipientForViewer(dbAdmin.role, u)) });
  } catch (err) {
    console.error("Admin chat recipients GET error:", err);
    return fail("Internal server error", 500);
  }
}
