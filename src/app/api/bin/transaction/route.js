import { connectDB } from "@/lib/db";
import { ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  await connectDB();
  const transactions = await Transaction.find({
    userId: user._id,
    isDeleted: true,
    deletionSource: "transaction_bin",
  })
    .populate("personId", "name")
    .sort({ deletedAt: -1 });

  const hydratedTransactions = transactions.map((tx) => {
    const plain = tx.toObject();
    const logs = Array.isArray(plain.changeLogs)
      ? plain.changeLogs.filter((log) => log?.message && log?.at)
      : [];

    if (!logs.some((log) => log.action === "created")) {
      logs.push({
        action: "created",
        message: `Transaction created at ${new Date(plain.createdAt || plain.date || new Date()).toLocaleString()}`,
        at: plain.createdAt || plain.date || new Date(),
      });
    }

    if (!logs.some((log) => log.action === "deleted")) {
      const deletedAt = plain.deletedAt || plain.lastDeletedAt || plain.createdAt || plain.date;
      if (deletedAt) {
        logs.push({
          action: "deleted",
          message: `Transaction deleted at ${new Date(deletedAt).toLocaleString()}`,
          at: deletedAt,
        });
      }
    }

    if (!logs.some((log) => log.action === "restored") && plain.lastRestoredAt) {
      logs.push({
        action: "restored",
        message: `Transaction restored at ${new Date(plain.lastRestoredAt).toLocaleString()}`,
        at: plain.lastRestoredAt,
      });
    }

    plain.changeLogs = logs;
    return plain;
  });

  return ok({ transactions: hydratedTransactions });
}
