import { connectDB } from "@/lib/db";
import { ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Person from "@/models/Person";
import Transaction from "@/models/Transaction";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  await connectDB();

  // Fetch both deleted people and transactions in parallel
  const [people, transactions] = await Promise.all([
    Person.find({ userId: user._id, isDeleted: true }).sort({ deletedAt: -1 }).lean(),
    Transaction.find({ userId: user._id, isDeleted: true }).sort({ deletedAt: -1 }).lean(),
  ]);

  return ok({
    people,
    transactions,
  });
}
