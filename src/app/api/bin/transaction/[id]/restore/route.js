import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import Person from "@/models/Person";
import { clearDashboardCache } from "@/lib/redis";

export async function POST(_request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await params;
  await connectDB();

  const tx = await Transaction.findOne({
    _id: id,
    userId: user._id,
    isDeleted: true,
    deletionSource: "transaction_bin",
  });
  if (!tx) return fail("Transaction not found in bin", 404);

  if (tx.restoreUntil && tx.restoreUntil < new Date()) {
    return fail("Restore window expired", 410);
  }

  const person = await Person.findOne({ _id: tx.personId, userId: user._id, isDeleted: { $ne: true } });
  if (!person) {
    return fail("Cannot restore: related person is missing or in bin", 409);
  }

  const eventAt = new Date();
  const restoredAtMessage = `Transaction restored at ${eventAt.toLocaleString()}`;

  await Transaction.updateOne(
    { _id: tx._id, userId: user._id, isDeleted: true, deletionSource: "transaction_bin" },
    {
      $set: { isDeleted: false, lastRestoredAt: eventAt },
      $unset: { deletedAt: 1, restoreUntil: 1, deletionSource: 1 },
      $push: {
        changeLogs: {
          action: "restored",
          message: restoredAtMessage,
          at: eventAt,
        },
      },
    }
  );

  await clearDashboardCache(user._id);
  return ok({ message: "Transaction restored" });
}
