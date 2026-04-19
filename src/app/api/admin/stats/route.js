import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Transaction from "@/models/Transaction";
import { requireAdmin } from "@/lib/adminSession";
import { ok, fail } from "@/lib/api";

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  try {
    await connectDB();

    const now = new Date();

    const [
      totalUsers,
      totalTransactions,
      activeSubscribers,
      newUsersThisMonth,
      newTransactionsThisMonth,
      recentUsers,
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
        .limit(5)
        .select("name email createdAt isPremium")
        .lean(),
    ]);

    // Monthly new user trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const count = await User.countDocuments({
        createdAt: { $gte: start, $lt: end },
      });
      monthlyTrend.push({
        month: start.toLocaleString("default", { month: "short", year: "2-digit" }),
        users: count,
      });
    }

    return ok({
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
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    return fail("Internal server error", 500);
  }
}
