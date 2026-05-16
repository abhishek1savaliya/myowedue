import "server-only";
import { connectDB } from "@/lib/db";
import PremiumFunnelEvent from "@/models/PremiumFunnelEvent";
import SubscriptionPayment from "@/models/SubscriptionPayment";
import User from "@/models/User";

const FUNNEL_EVENT_TYPES = [
  "upgrade_click",
  "subscription_page_view",
  "purchase_modal_open",
  "purchase_checkout_start",
  "purchase_completed",
];

export function isValidPremiumFunnelEventType(eventType) {
  return FUNNEL_EVENT_TYPES.includes(String(eventType || ""));
}

/**
 * @param {string | import("mongoose").Types.ObjectId | null} userId
 * @param {{ eventType: string; source?: string; path?: string; meta?: Record<string, unknown> }} payload
 */
export async function recordPremiumFunnelEvent(userId, payload) {
  if (!isValidPremiumFunnelEventType(payload?.eventType)) return;

  try {
    await connectDB();
    await PremiumFunnelEvent.create({
      userId: userId || null,
      eventType: payload.eventType,
      source: String(payload.source || "").slice(0, 120),
      path: String(payload.path || "").slice(0, 240),
      meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {},
      occurredAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to record premium funnel event:", error);
  }
}

function paymentRevenueUsd(payment) {
  const metaUsd = Number(payment?.meta?.amountUsd);
  if (Number.isFinite(metaUsd) && metaUsd > 0) return metaUsd;
  if (String(payment?.currency || "").toUpperCase() === "USD") {
    return Number(payment?.amount || 0);
  }
  return 0;
}

/**
 * Superadmin premium analytics bundle.
 * @param {Date} [now]
 */
export async function buildPremiumAdminInsights(now = new Date()) {
  await connectDB();

  const monthRanges = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    monthRanges.push({
      start,
      end,
      label: start.toLocaleString("default", { month: "short", year: "2-digit" }),
    });
  }

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    upgradeClicks,
    subscriptionPageViews,
    modalOpens,
    checkoutStarts,
    funnelCompletions,
    activeSubscribers,
    paidPayments,
    funnelLast30,
  ] = await Promise.all([
    PremiumFunnelEvent.countDocuments({ eventType: "upgrade_click" }),
    PremiumFunnelEvent.countDocuments({ eventType: "subscription_page_view" }),
    PremiumFunnelEvent.countDocuments({ eventType: "purchase_modal_open" }),
    PremiumFunnelEvent.countDocuments({ eventType: "purchase_checkout_start" }),
    PremiumFunnelEvent.countDocuments({ eventType: "purchase_completed" }),
    User.countDocuments({ isPremium: true, subscriptionEndDate: { $gt: now } }),
    SubscriptionPayment.find({
      status: "completed",
      eventType: { $in: ["purchase", "renewal"] },
    })
      .sort({ occurredAt: -1 })
      .limit(500)
      .select("userId eventType title amount currency billingCycle occurredAt meta")
      .lean(),
    PremiumFunnelEvent.aggregate([
      { $match: { occurredAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: "$eventType", count: { $sum: 1 } } },
    ]),
  ]);

  const paymentRows = Array.isArray(paidPayments) ? paidPayments : [];
  const funnelLast30Rows = Array.isArray(funnelLast30) ? funnelLast30 : [];

  let conversions = 0;
  let renewals = 0;
  let totalRevenueUsd = 0;
  let paidTransactionCount = 0;
  const monthlyMap = Object.fromEntries(monthRanges.map((r) => [r.label, { revenueUsd: 0, conversions: 0 }]));

  for (const payment of paymentRows) {
    const revenue = paymentRevenueUsd(payment);
    const isPaid = revenue > 0 || Number(payment.amount || 0) > 0;

    if (payment.eventType === "purchase") {
      conversions += 1;
    } else if (payment.eventType === "renewal") {
      renewals += 1;
    }

    if (isPaid) {
      paidTransactionCount += 1;
      totalRevenueUsd += revenue;
    }

    const occurred = payment.occurredAt ? new Date(payment.occurredAt) : null;
    if (occurred && payment.eventType === "purchase") {
      for (const range of monthRanges) {
        if (occurred >= range.start && occurred < range.end) {
          monthlyMap[range.label].conversions += 1;
          if (isPaid) monthlyMap[range.label].revenueUsd += revenue;
          break;
        }
      }
    } else if (occurred && isPaid) {
      for (const range of monthRanges) {
        if (occurred >= range.start && occurred < range.end) {
          monthlyMap[range.label].revenueUsd += revenue;
          break;
        }
      }
    }
  }

  const monthlyRevenue = monthRanges.map((r) => ({
    month: r.label,
    revenueUsd: Math.round((monthlyMap[r.label]?.revenueUsd || 0) * 100) / 100,
    conversions: monthlyMap[r.label]?.conversions || 0,
  }));

  const funnelDenominator = Math.max(modalOpens, upgradeClicks, 1);
  const conversionRatePct = Math.min(100, Math.round((conversions / funnelDenominator) * 1000) / 10);
  const checkoutToPurchasePct =
    checkoutStarts > 0 ? Math.min(100, Math.round((conversions / checkoutStarts) * 1000) / 10) : 0;

  const last30Map = Object.fromEntries(funnelLast30Rows.map((row) => [row._id, row.count]));

  const userIds = [
    ...new Set(paymentRows.slice(0, 12).map((p) => String(p.userId)).filter(Boolean)),
  ];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select("name email")
        .lean()
    : [];
  const userById = Object.fromEntries(users.map((u) => [String(u._id), u]));

  return {
    summary: {
      upgradeClicks,
      subscriptionPageViews,
      modalOpens,
      checkoutStarts,
      funnelCompletions,
      conversions,
      renewals,
      paidTransactionCount,
      totalRevenueUsd: Math.round(totalRevenueUsd * 100) / 100,
      activeSubscribers,
      conversionRatePct,
      checkoutToPurchasePct,
    },
    funnelLast30Days: {
      upgradeClicks: last30Map.upgrade_click || 0,
      subscriptionPageViews: last30Map.subscription_page_view || 0,
      modalOpens: last30Map.purchase_modal_open || 0,
      checkoutStarts: last30Map.purchase_checkout_start || 0,
      completions: last30Map.purchase_completed || 0,
    },
    monthlyRevenue,
    recentConversions: paymentRows
      .filter((p) => p.eventType === "purchase" || p.eventType === "renewal")
      .slice(0, 10)
      .map((p) => {
        const user = userById[String(p.userId)];
        return {
          id: String(p._id),
          eventType: p.eventType,
          title: p.title,
          amount: Number(p.amount || 0),
          currency: p.currency || "USD",
          revenueUsd: paymentRevenueUsd(p),
          billingCycle: p.billingCycle,
          occurredAt: p.occurredAt,
          userName: user?.name || "User",
          userEmail: user?.email || "",
          plan: p.meta?.subscriptionPlan || null,
        };
      }),
  };
}
