import { connectDB } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import { activeQuery } from "@/lib/bin";

export async function GET(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    await connectDB();

    const all = await Transaction.find({ userId: user._id }).select({
      amount: 1, encryptedAmount: 1, type: 1, isDeleted: 1, deletedAt: 1, date: 1,
    }).lean();

    const activeQueryObj = activeQuery();
    const active = await Transaction.find({ userId: user._id, ...activeQueryObj }).select({
      amount: 1, encryptedAmount: 1, type: 1, isDeleted: 1, deletedAt: 1, date: 1,
    }).lean();

    const deleted = all.filter(t => !active.some(a => a._id.toString() === t._id.toString()));

    return ok({
      summary: {
        totalInDb: all.length,
        activeShown: active.length,
        hiddenDeleted: deleted.length,
        byType: {
          active: {
            credit: active.filter(t => t.type === "credit").length,
            debit: active.filter(t => t.type === "debit").length,
          },
          hidden: {
            credit: deleted.filter(t => t.type === "credit").length,
            debit: deleted.filter(t => t.type === "debit").length,
          },
        },
      },
      hidden: deleted.map(t => ({
        id: t._id,
        type: t.type,
        isDeleted: t.isDeleted,
        deletedAt: t.deletedAt,
        date: t.date,
      })),
    });
  } catch (err) {
    return fail(err.message, 500);
  }
}


