import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import Person from "@/models/Person";
import { activeQuery } from "@/lib/bin";
import { getRedisJSON, setRedisJSON, transactionDataCacheKey } from "@/lib/redis";

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
  const cacheKey = transactionDataCacheKey(user._id, queryString);
  if (!forceFresh) {
    const cached = await getRedisJSON(cacheKey);
    if (cached) {
      return ok(cached);
    }
  }

  await connectDB();
  const q = searchParams.get("q")?.trim();
  const view = searchParams.get("view");
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const minAmount = Number(searchParams.get("minAmount") || 0);
  const maxAmount = Number(searchParams.get("maxAmount") || 0);

  const query = { userId: user._id, status: "pending", ...activeQuery() };
  if (view === "credit_pending") {
    query.status = "pending";
    query.type = "credit";
  } else if (view === "debit_pending") {
    query.status = "pending";
    query.type = "debit";
  }

  if (status === "pending") query.status = "pending";
  if (type && ["credit", "debit"].includes(type)) query.type = type;
  if (start || end) {
    query.date = {};
    if (start) query.date.$gte = new Date(start);
    if (end) query.date.$lte = new Date(end);
  }
  if (minAmount > 0 || maxAmount > 0) {
    query.amount = {};
    if (minAmount > 0) query.amount.$gte = minAmount;
    if (maxAmount > 0) query.amount.$lte = maxAmount;
  }

  if (q) {
    const people = await Person.find({
      userId: user._id,
      ...activeQuery(),
      name: { $regex: q, $options: "i" },
    });
    query.personId = { $in: people.map((p) => p._id) };
  }

  // Fetch both people and transactions in parallel
  const [allPeople, transactions] = await Promise.all([
    Person.find({ userId: user._id, ...activeQuery() }).sort({ createdAt: -1 }).lean(),
    Transaction.find(query)
      .populate("personId", "name email phone")
      .sort({ date: -1, createdAt: -1 }),
  ]);

  const hydratedTransactions = transactions.map((tx) => {
    const plain = tx.toObject();
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

    if (plain.lastDeletedAt) {
      fallbackLogs.push({
        action: "deleted",
        message: `Transaction deleted at ${new Date(plain.lastDeletedAt).toLocaleString()}`,
        at: plain.lastDeletedAt,
      });
    }

    if (plain.lastRestoredAt) {
      fallbackLogs.push({
        action: "restored",
        message: `Transaction restored at ${new Date(plain.lastRestoredAt).toLocaleString()}`,
        at: plain.lastRestoredAt,
      });
    }

    plain.changeLogs = fallbackLogs;
    return plain;
  });

  const payload = {
    people: allPeople,
    transactions: hydratedTransactions,
  };

  await setRedisJSON(cacheKey, payload, 60);
  return ok(payload);
}
