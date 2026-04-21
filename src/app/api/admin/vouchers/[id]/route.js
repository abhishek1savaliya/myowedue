import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/adminSession";
import SubscriptionVoucher from "@/models/SubscriptionVoucher";

export async function PATCH(request, { params }) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  if (!["superadmin", "manager"].includes(admin.role)) {
    return fail("Forbidden", 403);
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    await connectDB();
    const voucher = await SubscriptionVoucher.findById(id);
    if (!voucher) return fail("Voucher not found", 404);

    if (typeof body.isActive === "boolean") voucher.isActive = body.isActive;
    if (typeof body.notes === "string") voucher.notes = body.notes.trim();
    if (body.expiresAt !== undefined) {
      if (!body.expiresAt) {
        voucher.expiresAt = null;
      } else {
        const parsed = new Date(body.expiresAt);
        if (Number.isNaN(parsed.getTime())) return fail("Invalid expiry date", 422);
        voucher.expiresAt = parsed;
      }
    }

    await voucher.save();
    return ok({ message: "Voucher updated" });
  } catch (caughtError) {
    console.error("Admin vouchers PATCH error:", caughtError);
    return fail("Failed to update voucher", 500);
  }
}
