import { connectDB } from "@/lib/db";
import { ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Person from "@/models/Person";
import Transaction from "@/models/Transaction";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  await connectDB();
  const people = await Person.find({ userId: user._id, isDeleted: true }).sort({ deletedAt: -1 }).lean();

  const ids = people.map((p) => p._id);
  const tx = await Transaction.find({ userId: user._id, personId: { $in: ids }, isDeleted: true }).lean();

  const countByPerson = new Map();
  for (const t of tx) {
    const key = t.personId.toString();
    countByPerson.set(key, (countByPerson.get(key) || 0) + 1);
  }

  return ok({
    people: people.map((p) => ({
      ...p,
      deletedTransactions: countByPerson.get(p._id.toString()) || 0,
    })),
  });
}
