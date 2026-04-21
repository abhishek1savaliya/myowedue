import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireUser } from "@/lib/session";
import { fail, ok } from "@/lib/api";
import SubscriptionVoucher from "@/models/SubscriptionVoucher";
import { recordSubscriptionEvent } from "@/lib/subscription-history";
import { getPremiumGraceEndDate, hasActivePremium, PREMIUM_MONTHLY_DURATION_DAYS } from "@/lib/subscription";

const PREMIUM_YEARLY_DURATION_DAYS = 365;

export async function POST(req) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const body = await req.json().catch(() => ({}));
    const selectedPlan = body.plan === "pro_yearly" ? "pro_yearly" : "pro_monthly";
    const normalizedCode = String(body.voucherCode || "").trim().toUpperCase();

    await connectDB();
    const dbUser = await User.findById(user._id);
    if (!dbUser) return fail("User not found", 404);

    let durationDays = selectedPlan === "pro_yearly" ? PREMIUM_YEARLY_DURATION_DAYS : PREMIUM_MONTHLY_DURATION_DAYS;
    let amountCharged = selectedPlan === "pro_yearly" ? 70 : 7;
    let source = "manual_checkout";
    let plan = selectedPlan;
    let billingCycle = selectedPlan === "pro_yearly" ? "yearly" : "monthly";
    let voucher = null;

    if (normalizedCode) {
      if (selectedPlan === "pro_yearly") {
        return fail("Voucher code is only valid for monthly plan", 400);
      }

      voucher = await SubscriptionVoucher.findOne({ code: normalizedCode });
      if (!voucher || !voucher.isActive) return fail("Invalid voucher code", 400);
      if (voucher.expiresAt && voucher.expiresAt < new Date()) return fail("Voucher code has expired", 400);
      if (voucher.redemptionCount >= voucher.maxRedemptions) return fail("Voucher code has reached its usage limit", 400);

      if (voucher.plan !== "pro_monthly") {
        return fail("This voucher is not valid for the selected plan", 400);
      }

      durationDays = Number(voucher.durationDays || PREMIUM_MONTHLY_DURATION_DAYS);
      amountCharged = 0;
      source = "voucher";
      plan = "pro_monthly";
      billingCycle = "monthly";
    }

    const now = new Date();
    const canExtendFromCurrentEnd = Boolean(
      hasActivePremium(dbUser) && dbUser.subscriptionEndDate && new Date(dbUser.subscriptionEndDate) > now
    );
    const baseDate = canExtendFromCurrentEnd ? new Date(dbUser.subscriptionEndDate) : now;
    const nextEndDate = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    dbUser.isPremium = true;
    dbUser.subscriptionPlan = plan;
    dbUser.subscriptionEndDate = nextEndDate;
    dbUser.appliedVoucherCode = normalizedCode || null;

    if (voucher) {
      voucher.redemptionCount += 1;
      voucher.redeemedByUserIds.push(dbUser._id);
      if (voucher.redemptionCount >= voucher.maxRedemptions) {
        voucher.isActive = false;
      }
    }

    await dbUser.save();
    if (voucher) await voucher.save();

    const eventType = canExtendFromCurrentEnd ? "renewal" : "purchase";
    await recordSubscriptionEvent(dbUser._id, {
      eventType,
      title: canExtendFromCurrentEnd ? "Subscription renewed" : "Subscription activated",
      description: normalizedCode
        ? `Subscription activated using voucher ${normalizedCode}.`
        : `Subscription activated via ${plan === "pro_yearly" ? "Pro yearly" : "Pro monthly"} payment.`,
      status: "completed",
      amount: amountCharged,
      currency: "USD",
      billingCycle,
      meta: {
        source,
        voucherCode: normalizedCode || null,
        subscriptionPlan: plan,
        subscriptionEndDate: nextEndDate,
      },
    });

    if (voucher) {
      await recordSubscriptionEvent(dbUser._id, {
        eventType: "voucher_applied",
        title: `Voucher ${normalizedCode} applied`,
        description: `Voucher ${normalizedCode} set payable amount to $0.`,
        status: "completed",
        amount: 0,
        currency: "USD",
        billingCycle: "voucher",
        meta: {
          voucherCode: normalizedCode,
          generatedByAdminName: voucher.generatedByAdminName || "",
          subscriptionPlan: plan,
        },
      });
    }

    return ok({
      success: true,
      message: "Subscription activated",
      isPremium: true,
      subscriptionPlan: plan,
      amountCharged,
      voucherApplied: normalizedCode || null,
      activatedAt: new Date(),
      subscriptionEndDate: nextEndDate,
      graceEndDate: getPremiumGraceEndDate(dbUser),
    });
  } catch (caughtError) {
    console.error("Subscription purchase error:", caughtError);
    return fail("Internal server error", 500);
  }
}
