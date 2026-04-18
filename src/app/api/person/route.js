import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Person from "@/models/Person";
import Transaction from "@/models/Transaction";
import { activeQuery } from "@/lib/bin";
import { clearDashboardCache, getRedisJSON, peopleCacheKey, setRedisJSON } from "@/lib/redis";

export async function GET(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const cacheKey = peopleCacheKey(user._id);
  const cached = await getRedisJSON(cacheKey);
  if (cached) {
    return ok(cached);
  }

  await connectDB();
  const people = await Person.find({ userId: user._id, ...activeQuery() }).sort({ createdAt: -1 }).lean();

  const personIds = people.map((p) => p._id);
  const tx = await Transaction.find({ userId: user._id, personId: { $in: personIds }, ...activeQuery() }).lean();

  const balanceMap = new Map();
  for (const p of people) {
    balanceMap.set(p._id.toString(), {
      totalCredit: 0,
      totalDebit: 0,
      pendingCredit: 0,
      pendingDebit: 0,
      totalCreditByCurrency: {},
      totalDebitByCurrency: {},
      pendingCreditByCurrency: {},
      pendingDebitByCurrency: {},
      netDue: 0,
      dueAmount: 0,
      dueDirection: "settled",
    });
  }

  for (const item of tx) {
    const bucket = balanceMap.get(item.personId.toString());
    if (!bucket) continue;
    const currency = item.currency || "USD";

    if (item.type === "credit") {
      bucket.totalCredit += item.amount;
      bucket.totalCreditByCurrency[currency] = (bucket.totalCreditByCurrency[currency] || 0) + item.amount;
    }
    if (item.type === "debit") {
      bucket.totalDebit += item.amount;
      bucket.totalDebitByCurrency[currency] = (bucket.totalDebitByCurrency[currency] || 0) + item.amount;
    }

    if (item.status === "pending") {
      if (item.type === "credit") {
        bucket.pendingCredit += item.amount;
        bucket.pendingCreditByCurrency[currency] = (bucket.pendingCreditByCurrency[currency] || 0) + item.amount;
      }
      if (item.type === "debit") {
        bucket.pendingDebit += item.amount;
        bucket.pendingDebitByCurrency[currency] = (bucket.pendingDebitByCurrency[currency] || 0) + item.amount;
      }
    }
  }

  for (const bucket of balanceMap.values()) {
    bucket.netDue = bucket.pendingDebit - bucket.pendingCredit;
    bucket.dueAmount = Math.abs(bucket.netDue);
    bucket.dueDirection = bucket.netDue < 0 ? "person_owes_you" : bucket.netDue > 0 ? "you_owe_person" : "settled";
  }

  const data = people.map((p) => ({ ...p, ...balanceMap.get(p._id.toString()) }));
  const payload = { people: data };
  await setRedisJSON(cacheKey, payload, 90);
  return ok(payload);
}

export async function POST(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { name, email, phone } = await request.json();
    if (!name) return fail("Person name is required", 422);

    await connectDB();
    const person = await Person.create({
      userId: user._id,
      name: name.trim(),
      email: email?.trim().toLowerCase() || "",
      phone: phone?.trim() || "",
    });

    await clearDashboardCache(user._id);
    await logActivity(user._id, "person_created", `Created ${person.name}`);
    return ok({ person }, 201);
  } catch {
    return fail("Failed to create person", 500);
  }
}
