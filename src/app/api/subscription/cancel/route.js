import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireUser } from "@/lib/session";
import { fail, ok } from "@/lib/api";

export async function POST(req) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    await connectDB();
    const dbUser = await User.findById(user._id);
    if (!dbUser) return fail("User not found", 404);

    if (!dbUser.isPremium) {
      return fail("You don't have an active premium subscription", 400);
    }

    // Cancel the subscription
    dbUser.isPremium = false;
    dbUser.subscriptionEndDate = null;
    dbUser.appliedVoucherCode = null;
    await dbUser.save();

    return ok({
      success: true,
      message: "Subscription cancelled successfully. You're now on the free tier.",
      isPremium: false,
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return fail("Internal server error", 500);
  }
}
