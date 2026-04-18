import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireUser } from "@/lib/session";
import { fail, ok } from "@/lib/api";

// Valid voucher codes and their durations (in days)
const VALID_VOUCHERS = {
  "XXFREE1M": 30, // 1 month free
};

export async function POST(req) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { voucherCode } = await req.json();
    if (!voucherCode?.trim()) {
      return fail("Voucher code is required", 400);
    }

    const normalizedCode = voucherCode.trim().toUpperCase();
    if (!VALID_VOUCHERS[normalizedCode]) {
      return fail("Invalid voucher code", 400);
    }

    await connectDB();
    const dbUser = await User.findById(user._id);
    if (!dbUser) return fail("User not found", 404);

    // Check if voucher already used
    if (dbUser.appliedVoucherCode) {
      return fail(`You have already applied voucher code: ${dbUser.appliedVoucherCode}`, 400);
    }

    // Calculate subscription end date
    const now = new Date();
    const endDate = new Date(now.getTime() + VALID_VOUCHERS[normalizedCode] * 24 * 60 * 60 * 1000);

    // If already premium, extend the subscription
    if (dbUser.isPremium && dbUser.subscriptionEndDate > now) {
      const extendedEndDate = new Date(dbUser.subscriptionEndDate.getTime() + VALID_VOUCHERS[normalizedCode] * 24 * 60 * 60 * 1000);
      dbUser.subscriptionEndDate = extendedEndDate;
    } else {
      dbUser.isPremium = true;
      dbUser.subscriptionEndDate = endDate;
    }

    dbUser.appliedVoucherCode = normalizedCode;
    await dbUser.save();

    return ok({
      success: true,
      message: "Premium subscription activated!",
      subscriptionEndDate: dbUser.subscriptionEndDate,
      isPremium: true,
    });
  } catch (error) {
    console.error("Voucher validation error:", error);
    return fail("Internal server error", 500);
  }
}
