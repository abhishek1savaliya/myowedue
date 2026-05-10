import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Transaction from "@/models/Transaction";
import { fetchSuperadminAnalyticsExtras } from "@/lib/adminSuperadminAnalytics";

/**
 * Full superadmin analytics payload (same shape as GET /api/admin/stats).
 * Used by the stats API and PDF export.
 */
export async function buildSuperadminStatsBundle() {
  await connectDB();

  const now = new Date();

  const [
    totalUsers,
    totalTransactions,
    activeSubscribers,
    newUsersThisMonth,
    newTransactionsThisMonth,
    recentUsers,
    extras,
  ] = await Promise.all([
    User.countDocuments({}),
    Transaction.countDocuments({ isDeleted: false }),
    User.countDocuments({
      isPremium: true,
      subscriptionEndDate: { $gt: now },
    }),
    User.countDocuments({
      createdAt: {
        $gte: new Date(now.getFullYear(), now.getMonth(), 1),
      },
    }),
    Transaction.countDocuments({
      isDeleted: false,
      createdAt: {
        $gte: new Date(now.getFullYear(), now.getMonth(), 1),
      },
    }),
    User.find({})
      .sort({ createdAt: -1 })
      .limit(8)
      .select("name email createdAt isPremium")
      .lean(),
    fetchSuperadminAnalyticsExtras(now),
  ]);

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
  const monthCounts = await Promise.all(
    monthRanges.map(({ start, end }) =>
      Promise.all([
        User.countDocuments({ createdAt: { $gte: start, $lt: end } }),
        Transaction.countDocuments({
          isDeleted: false,
          createdAt: { $gte: start, $lt: end },
        }),
      ])
    )
  );
  const monthlyTrend = monthRanges.map((r, i) => ({
    month: r.label,
    users: monthCounts[i][0],
  }));
  const monthlyTransactionsTrend = monthRanges.map((r, i) => ({
    month: r.label,
    transactions: monthCounts[i][1],
  }));

  return {
    stats: {
      totalUsers,
      totalTransactions,
      activeSubscribers,
      newUsersThisMonth,
      newTransactionsThisMonth,
    },
    recentUsers: recentUsers.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      isPremium: Boolean(u.isPremium),
      joinedAt: u.createdAt,
    })),
    monthlyTrend,
    monthlyTransactionsTrend,
    ...extras,
  };
}
