import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Person from "@/models/Person";
import Transaction from "@/models/Transaction";
import { activeQuery } from "@/lib/bin";
import { clearDashboardCache, getRedisJSON, peopleCacheKey, setRedisJSON } from "@/lib/redis";
import { deriveUserKey, decryptTransactionAmount } from "@/lib/crypto";
import { FREE_RECORD_LIMIT, hasActivePremium } from "@/lib/subscription";

export async function GET(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const cacheControl = String(request.headers.get("cache-control") || "").toLowerCase();
  const pragma = String(request.headers.get("pragma") || "").toLowerCase();
  const forceFresh =
    searchParams.has("_r") ||
    cacheControl.includes("no-store") ||
    cacheControl.includes("no-cache") ||
    pragma.includes("no-cache");

  const cacheKey = peopleCacheKey(user._id);
  if (!forceFresh) {
    const cached = await getRedisJSON(cacheKey);
    if (cached) {
      return ok(cached);
    }
  }

  await connectDB();
  const people = await Person.find({ userId: user._id, ...activeQuery() }).sort({ createdAt: -1 }).lean();

  const personIds = people.map((p) => p._id);
  const tx = await Transaction.find({ userId: user._id, personId: { $in: personIds }, ...activeQuery() }).lean();

  // Derive encryption key for decryption
  const userKey = await deriveUserKey(user._id.toString(), user.email);

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

    let decryptedAmount = item.amount;
    if (item.encryptedAmount) {
      try {
        decryptedAmount = await decryptTransactionAmount(item, userKey);
      } catch (err) {
        console.error(`Failed to decrypt transaction ${item._id}:`, err.message);
        if (!decryptedAmount) continue; // Skip if decryption fails and no plain amount
      }
    }

    if (item.type === "credit") {
      bucket.totalCredit += decryptedAmount;
      bucket.totalCreditByCurrency[currency] = (bucket.totalCreditByCurrency[currency] || 0) + decryptedAmount;
    }
    if (item.type === "debit") {
      bucket.totalDebit += decryptedAmount;
      bucket.totalDebitByCurrency[currency] = (bucket.totalDebitByCurrency[currency] || 0) + decryptedAmount;
    }

    if (item.type === "credit") {
      bucket.pendingCredit += decryptedAmount;
      bucket.pendingCreditByCurrency[currency] = (bucket.pendingCreditByCurrency[currency] || 0) + decryptedAmount;
    }
    if (item.type === "debit") {
      bucket.pendingDebit += decryptedAmount;
      bucket.pendingDebitByCurrency[currency] = (bucket.pendingDebitByCurrency[currency] || 0) + decryptedAmount;
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
    if (!hasActivePremium(user)) {
      const activeCount = await Person.countDocuments({ userId: user._id, ...activeQuery() });
      if (activeCount >= FREE_RECORD_LIMIT) {
        return fail(`Free plan supports up to ${FREE_RECORD_LIMIT} active people. Upgrade to Pro for unlimited records.`, 403);
      }
    }

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
