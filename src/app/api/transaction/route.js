import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import Person from "@/models/Person";
import { activeQuery } from "@/lib/bin";
import {
  clearDashboardCache,
  getRedisJSON,
  setRedisJSON,
  transactionListCacheKey,
} from "@/lib/redis";
import { deriveUserKey, decryptTransaction, encryptTransaction } from "@/lib/crypto";

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
  const queryString = searchParams.toString();
  const cacheKey = transactionListCacheKey(user._id, queryString);
  if (!forceFresh) {
    const cached = await getRedisJSON(cacheKey);
    if (cached) {
      return ok(cached);
    }
  }

  await connectDB();
  const q = searchParams.get("q")?.trim();
  const view = searchParams.get("view");
  const type = searchParams.get("type");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const minAmount = Number(searchParams.get("minAmount") || 0);
  const maxAmount = Number(searchParams.get("maxAmount") || 0);

  const query = { userId: user._id, ...activeQuery() };
  if (view === "credit") {
    query.type = "credit";
  } else if (view === "debit") {
    query.type = "debit";
  }

  if (type && ["credit", "debit"].includes(type)) query.type = type;
  if (start || end) {
    query.date = {};
    if (start) query.date.$gte = new Date(start);
    if (end) query.date.$lte = new Date(end);
  }
  // Note: amount range filter is applied in-memory after decryption
  // because encrypted transactions don't have a plain `amount` field in DB

  if (q) {
    const people = await Person.find({
      userId: user._id,
      ...activeQuery(),
      name: { $regex: q, $options: "i" },
    });
    query.personId = { $in: people.map((p) => p._id) };
  }

  const transactions = await Transaction.find(query)
    .populate("personId", "name email phone")
    .sort({ date: -1, createdAt: -1 });

  // Derive user's encryption key for decryption
  const userKey = await deriveUserKey(user._id.toString(), user.email);

  const hydratedTransactions = await Promise.all(
    transactions.map(async (tx) => {
      const plain = tx.toObject();
      
      // Decrypt encrypted fields if they exist
      try {
        if (plain.encryptedAmount) {
          const decrypted = await decryptTransaction(plain, userKey);
          plain.amount = decrypted.amount;
          if (decrypted.notes !== undefined) plain.notes = decrypted.notes;
        }
        // If neither encryptedAmount nor amount exists, something is wrong
        if (plain.amount === undefined) {
          console.warn(`Transaction ${plain._id} has no amount or encryptedAmount`);
        }
      } catch (decryptError) {
        console.error(`Failed to decrypt transaction ${plain._id}:`, decryptError.message);
        // If decryption fails and we have plain amount, keep it
        if (plain.amount === undefined) {
          console.error(`Transaction ${plain._id} cannot be decrypted and has no plain amount`);
        }
      }
      
      const existingLogs = Array.isArray(plain.changeLogs)
        ? plain.changeLogs.filter((log) => log?.message && log?.at)
        : [];

      if (existingLogs.length > 0) {
        const hasCreatedLog = existingLogs.some((log) => log.action === "created");
        const hasDeletedLog = existingLogs.some((log) => log.action === "deleted");
        const hasRestoredLog = existingLogs.some((log) => log.action === "restored");

        if (!hasCreatedLog) {
          existingLogs.push({
            action: "created",
            message: `Transaction created at ${new Date(plain.createdAt || plain.date || new Date()).toLocaleString()}`,
            at: plain.createdAt || plain.date || new Date(),
          });
        }

        if (!hasDeletedLog && plain.lastDeletedAt) {
          existingLogs.push({
            action: "deleted",
            message: `Transaction deleted at ${new Date(plain.lastDeletedAt).toLocaleString()}`,
            at: plain.lastDeletedAt,
          });
        }

        if (!hasRestoredLog && plain.lastRestoredAt) {
          existingLogs.push({
            action: "restored",
            message: `Transaction restored at ${new Date(plain.lastRestoredAt).toLocaleString()}`,
            at: plain.lastRestoredAt,
          });
        }

        plain.changeLogs = existingLogs;
        return plain;
      }

      const fallbackLogs = [
        {
          action: "created",
          message: `Transaction created at ${new Date(plain.createdAt || plain.date || new Date()).toLocaleString()}`,
          at: plain.createdAt || plain.date || new Date(),
        },
      ];

      plain.changeLogs = fallbackLogs;
      return plain;
    })
  );

  // Apply amount range filter in-memory after decryption
  const filtered =
    minAmount > 0 || maxAmount > 0
      ? hydratedTransactions.filter((tx) => {
          const amt = Number(tx.amount || 0);
          if (minAmount > 0 && amt < minAmount) return false;
          if (maxAmount > 0 && amt > maxAmount) return false;
          return true;
        })
      : hydratedTransactions;

  const payload = { transactions: filtered };
  await setRedisJSON(cacheKey, payload, 60);
  return ok(payload);
}

export async function POST(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { personId, amount, type, notes, date, currency } = body;

    if (!personId || !amount || !type || !date) {
      return fail("personId, amount, type and date are required", 422);
    }
    if (!["credit", "debit"].includes(type)) return fail("Invalid type", 422);

    await connectDB();
    const person = await Person.findOne({ _id: personId, userId: user._id, ...activeQuery() });
    if (!person) return fail("Person not found", 404);

    // Derive user's encryption key
    const userKey = await deriveUserKey(user._id.toString(), user.email);

    const txData = {
      userId: user._id,
      personId,
      // Don't store plain amount - only encrypted version
      type,
      // Don't store plain notes - only encrypted version
      date: new Date(date),
      currency: currency || "USD",
      status: "pending",
      changeLogs: [
        {
          action: "created",
          message: `Transaction created at ${new Date().toLocaleString()}`,
          at: new Date(),
        },
      ],
    };

    // Encrypt sensitive fields ONLY - these will be the only versions stored
    const encrypted = await encryptTransaction(
      { ...txData, amount, notes: notes || "" },
      userKey
    );
    
    const tx = await Transaction.create(encrypted);

    await clearDashboardCache(user._id);
    await logActivity(user._id, "transaction_created", `${type} transaction created`);
    
    // Return decrypted version to client
    const decrypted = await decryptTransaction(tx.toObject(), userKey);
    return ok({ transaction: decrypted }, 201);
  } catch (error) {
    console.error("Transaction creation error:", error);
    return fail("Failed to create transaction", 500);
  }
}
