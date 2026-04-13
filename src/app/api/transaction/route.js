import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import Person from "@/models/Person";
import { activeQuery } from "@/lib/bin";
import { clearDashboardCache } from "@/lib/redis";

export async function GET(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  await connectDB();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const view = searchParams.get("view");
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const minAmount = Number(searchParams.get("minAmount") || 0);
  const maxAmount = Number(searchParams.get("maxAmount") || 0);

  const query = { userId: user._id, ...activeQuery() };
  if (view === "credit_pending") {
    query.status = "pending";
    query.type = "credit";
  } else if (view === "debit_pending") {
    query.status = "pending";
    query.type = "debit";
  } else if (view === "paid") {
    query.status = "paid";
  }

  if (status && ["pending", "paid"].includes(status)) query.status = status;
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

  const transactions = await Transaction.find(query)
    .populate("personId", "name email phone")
    .sort({ date: -1, createdAt: -1 });

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

    if (plain.status === "paid" && plain.paidAt) {
      fallbackLogs.push({
        action: "status_changed",
        message: "Marked PAID",
        at: plain.paidAt,
      });
    }

    plain.changeLogs = fallbackLogs;
    return plain;
  });

  return ok({ transactions: hydratedTransactions });
}

export async function POST(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { personId, amount, type, status, notes, date, currency } = body;

    if (!personId || !amount || !type || !date) {
      return fail("personId, amount, type and date are required", 422);
    }
    if (!["credit", "debit"].includes(type)) return fail("Invalid type", 422);
    if (status && !["pending", "paid"].includes(status)) return fail("Invalid status", 422);

    await connectDB();
    const person = await Person.findOne({ _id: personId, userId: user._id, ...activeQuery() });
    if (!person) return fail("Person not found", 404);

    const tx = await Transaction.create({
      userId: user._id,
      personId,
      amount: Number(amount),
      type,
      notes: notes || "",
      date: new Date(date),
      currency: currency || "USD",
      status: status || "pending",
      changeLogs: [
        {
          action: "created",
          message: `Transaction created at ${new Date().toLocaleString()}`,
          at: new Date(),
        },
      ],
    });

    await clearDashboardCache(user._id);
    await logActivity(user._id, "transaction_created", `${type} ${amount} ${currency || "USD"}`);
    return ok({ transaction: tx }, 201);
  } catch {
    return fail("Failed to create transaction", 500);
  }
}
