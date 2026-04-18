import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireUser } from "@/lib/session";
import { fail, ok } from "@/lib/api";

export async function GET(req) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    await connectDB();
    const dbUser = await User.findById(user._id);
    if (!dbUser) return fail("User not found", 404);

    const now = new Date();
    const isSubscriptionActive = dbUser.isPremium && dbUser.subscriptionEndDate && dbUser.subscriptionEndDate > now;

    return ok({
      isPremium: isSubscriptionActive,
      subscriptionEndDate: isSubscriptionActive ? dbUser.subscriptionEndDate : null,
      appliedVoucherCode: dbUser.appliedVoucherCode || null,
    });
  } catch (error) {
    console.error("Subscription status error:", error);
    return fail("Internal server error", 500);
  }
}
