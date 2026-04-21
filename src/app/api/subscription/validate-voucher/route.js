import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireUser } from "@/lib/session";
import { fail, ok } from "@/lib/api";
import { recordSubscriptionEvent } from "@/lib/subscription-history";
import SubscriptionVoucher from "@/models/SubscriptionVoucher";

export async function POST(req) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { voucherCode } = await req.json();
    if (!voucherCode?.trim()) {
      return fail("Voucher code is required", 400);
    }

    const normalizedCode = voucherCode.trim().toUpperCase();

    await connectDB();
    const dbUser = await User.findById(user._id);
    if (!dbUser) return fail("User not found", 404);
    const voucher = await SubscriptionVoucher.findOne({ code: normalizedCode });
    if (!voucher || !voucher.isActive) {
      return fail("Invalid voucher code", 400);
    }
    if (voucher.plan !== "pro_monthly") {
      return fail("Voucher code is only valid for monthly plan", 400);
    }
    if (voucher.expiresAt && voucher.expiresAt < new Date()) {
      return fail("Voucher code has expired", 400);
    }
    if (voucher.redemptionCount >= voucher.maxRedemptions) {
      return fail("Voucher code has reached its usage limit", 400);
    }

    // Check if voucher already used
    if (dbUser.appliedVoucherCode) {
      return fail(`You have already applied voucher code: ${dbUser.appliedVoucherCode}`, 400);
    }

    // Calculate subscription end date
    const now = new Date();
    const endDate = new Date(now.getTime() + voucher.durationDays * 24 * 60 * 60 * 1000);

    // If already premium, extend the subscription
    const isRenewal = Boolean(dbUser.isPremium && dbUser.subscriptionEndDate > now);
    if (isRenewal) {
      const extendedEndDate = new Date(dbUser.subscriptionEndDate.getTime() + voucher.durationDays * 24 * 60 * 60 * 1000);
      dbUser.subscriptionEndDate = extendedEndDate;
    } else {
      dbUser.isPremium = true;
      dbUser.subscriptionEndDate = endDate;
    }

    dbUser.subscriptionPlan = voucher.plan;
    dbUser.appliedVoucherCode = normalizedCode;
    voucher.redemptionCount += 1;
    voucher.redeemedByUserIds.push(dbUser._id);
    if (voucher.redemptionCount >= voucher.maxRedemptions) {
      voucher.isActive = false;
    }
    await dbUser.save();
    await voucher.save();

    await recordSubscriptionEvent(dbUser._id, {
      eventType: "voucher_applied",
      title: `Voucher ${normalizedCode} applied`,
      description: `Voucher ${normalizedCode} activated ${dbUser.subscriptionPlan === "pro_yearly" ? "Pro Yearly" : "Pro Monthly"}.`,
      status: "completed",
      amount: 0,
      currency: "USD",
      billingCycle: "voucher",
      meta: {
        voucherCode: normalizedCode,
        subscriptionPlan: dbUser.subscriptionPlan,
        subscriptionEndDate: dbUser.subscriptionEndDate,
        generatedByAdminName: voucher.generatedByAdminName || "",
      },
    });

    await recordSubscriptionEvent(dbUser._id, {
      eventType: isRenewal ? "renewal" : "purchase",
      title: isRenewal ? "Subscription renewed" : "Subscription activated",
      description: isRenewal
        ? `Subscription renewed via voucher ${normalizedCode}.`
        : `Subscription activated via voucher ${normalizedCode}.`,
      status: "completed",
      amount: 0,
      currency: "USD",
      billingCycle: dbUser.subscriptionPlan === "pro_yearly" ? "yearly" : "monthly",
      meta: {
        source: "voucher",
        voucherCode: normalizedCode,
        subscriptionPlan: dbUser.subscriptionPlan,
        generatedByAdminName: voucher.generatedByAdminName || "",
      },
    });

    return ok({
      success: true,
      message: "Premium subscription activated!",
      subscriptionEndDate: dbUser.subscriptionEndDate,
      isPremium: true,
      subscriptionPlan: dbUser.subscriptionPlan,
    });
  } catch (error) {
    console.error("Voucher validation error:", error);
    return fail("Internal server error", 500);
  }
}
