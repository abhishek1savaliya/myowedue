import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireUser } from "@/lib/session";
import { fail, ok } from "@/lib/api";
import { getEffectivePlan, getPremiumGraceEndDate, hasActivePremium, isInPremiumGrace } from "@/lib/subscription";

export async function GET(req) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    await connectDB();
    const dbUser = await User.findById(user._id);
    if (!dbUser) return fail("User not found", 404);

    const isSubscriptionActive = hasActivePremium(dbUser);
    const inGracePeriod = isInPremiumGrace(dbUser);
    const graceEndDate = getPremiumGraceEndDate(dbUser);
    const plan = getEffectivePlan(dbUser);

    return ok({
      isPremium: isSubscriptionActive,
      inGracePeriod,
      subscriptionPlan: plan.key,
      subscriptionLabel: plan.label,
      subscriptionEndDate: isSubscriptionActive ? dbUser.subscriptionEndDate : null,
      graceEndDate: isSubscriptionActive ? graceEndDate : null,
      appliedVoucherCode: dbUser.appliedVoucherCode || null,
    });
  } catch (error) {
    console.error("Subscription status error:", error);
    return fail("Internal server error", 500);
  }
}
