import { connectDB } from "@/lib/db";
import { ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import Person from "@/models/Person";
import { activeQuery } from "@/lib/bin";
import { dashboardCacheKey, getRedisJSON, setRedisJSON } from "@/lib/redis";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const cacheKey = dashboardCacheKey(user._id);
  const cached = await getRedisJSON(cacheKey);
  if (cached) {
    return ok(cached);
  }

  await connectDB();

  const [transactions, people] = await Promise.all([
    Transaction.find({ userId: user._id, ...activeQuery() }).populate("personId", "name"),
    Person.find({ userId: user._id, ...activeQuery() }),
  ]);

  let totalReceive = 0;
  let totalPay = 0;
  const pending = [];
  const paid = [];
  const monthlyMap = new Map();
  const personMap = new Map();

  for (const tx of transactions) {
    if (tx.type === "credit") totalReceive += tx.amount;
    if (tx.type === "debit") totalPay += tx.amount;

    if (tx.status === "pending") pending.push(tx);
    if (tx.status === "paid") paid.push(tx);

    const monthKey = new Date(tx.date).toISOString().slice(0, 7);
    const currentMonth = monthlyMap.get(monthKey) || { credit: 0, debit: 0 };
    currentMonth[tx.type] += tx.amount;
    monthlyMap.set(monthKey, currentMonth);

    const personName = tx.personId?.name || "Unknown";
    const currentPerson = personMap.get(personName) || { credit: 0, debit: 0 };
    currentPerson[tx.type] += tx.amount;
    personMap.set(personName, currentPerson);
  }

  const payload = {
    totals: { totalReceive, totalPay },
    recent: transactions.slice(0, 8),
    pending: pending.slice(0, 12),
    paid: paid.slice(0, 12),
    monthlyInsights: Array.from(monthlyMap.entries()).map(([month, value]) => ({ month, ...value })),
    personInsights: Array.from(personMap.entries()).map(([person, value]) => ({ person, ...value })),
    notificationCount: pending.length,
    peopleCount: people.length,
  };

  await setRedisJSON(cacheKey, payload, 90);
  return ok(payload);
}
