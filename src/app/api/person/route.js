import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Person from "@/models/Person";
import Transaction from "@/models/Transaction";
import { activeQuery } from "@/lib/bin";
import { clearDashboardCache } from "@/lib/redis";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  await connectDB();
  const people = await Person.find({ userId: user._id, ...activeQuery() }).sort({ createdAt: -1 }).lean();

  const personIds = people.map((p) => p._id);
  const tx = await Transaction.find({ userId: user._id, personId: { $in: personIds }, ...activeQuery() }).lean();

  const balanceMap = new Map();
  for (const p of people) {
    balanceMap.set(p._id.toString(), { totalCredit: 0, totalDebit: 0 });
  }

  for (const item of tx) {
    const bucket = balanceMap.get(item.personId.toString());
    if (!bucket) continue;
    if (item.type === "credit") bucket.totalCredit += item.amount;
    if (item.type === "debit") bucket.totalDebit += item.amount;
  }

  const data = people.map((p) => ({ ...p, ...balanceMap.get(p._id.toString()) }));
  return ok({ people: data });
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
