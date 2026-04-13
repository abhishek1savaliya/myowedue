import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Person from "@/models/Person";
import Transaction from "@/models/Transaction";
import { clearDashboardCache } from "@/lib/redis";

export async function POST(_request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await params;
  await connectDB();

  const person = await Person.findOne({ _id: id, userId: user._id, isDeleted: true });
  if (!person) return fail("Person not found in bin", 404);

  if (person.restoreUntil && person.restoreUntil < new Date()) {
    return fail("Restore window expired", 410);
  }

  await Person.updateOne(
    { _id: person._id },
    { $set: { isDeleted: false }, $unset: { deletedAt: 1, restoreUntil: 1 } }
  );

  const eventAt = new Date();

  await Transaction.updateMany(
    {
      userId: user._id,
      personId: person._id,
      isDeleted: true,
    },
    {
      $set: { isDeleted: false, lastRestoredAt: eventAt, status: "pending", paidAt: null },
      $unset: { deletedAt: 1, restoreUntil: 1, deletionSource: 1 },
      $push: {
        changeLogs: {
          action: "restored",
          message: `Transaction restored at ${eventAt.toLocaleString()}`,
          at: eventAt,
        },
      },
    }
  );

  await clearDashboardCache(user._id);
  return ok({ message: "Person restored" });
}
