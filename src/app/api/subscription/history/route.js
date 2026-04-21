import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import SubscriptionPayment from "@/models/SubscriptionPayment";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    await connectDB();
    const history = await SubscriptionPayment.find({ userId: user._id })
      .sort({ occurredAt: -1, createdAt: -1 })
      .lean();

    return ok({ history });
  } catch (caughtError) {
    console.error("Subscription history error:", caughtError);
    return fail("Failed to load subscription history", 500);
  }
}
