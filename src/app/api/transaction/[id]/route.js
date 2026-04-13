import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import Person from "@/models/Person";
import { sendPaymentReceivedMail } from "@/lib/reminders";
import { activeQuery, buildBinMeta } from "@/lib/bin";
import { clearDashboardCache } from "@/lib/redis";

export async function PUT(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const eventAt = new Date();
    const eventAtText = eventAt.toLocaleString();

    await connectDB();
    const existing = await Transaction.findOne({ _id: id, userId: user._id, ...activeQuery() });
    if (!existing) return fail("Transaction not found", 404);

    let nextPersonId = existing.personId;
    let nextPersonName = null;
    const previousPerson = await Person.findOne({ _id: existing.personId, userId: user._id });
    const previousPersonName = previousPerson?.name || "Unknown";
    if (body.personId && body.personId !== existing.personId.toString()) {
      const person = await Person.findOne({ _id: body.personId, userId: user._id, ...activeQuery() });
      if (!person) return fail("Selected person not found", 404);
      nextPersonId = person._id;
      nextPersonName = person.name;
    } else {
      nextPersonName = previousPersonName;
    }

    const setFields = {
      personId: nextPersonId,
      amount: body.amount != null ? Number(body.amount) : existing.amount,
      type: body.type || existing.type,
      notes: body.notes ?? existing.notes,
      currency: body.currency || existing.currency,
      date: body.date ? new Date(body.date) : existing.date,
      status: body.status || existing.status,
    };

    // If type is being explicitly edited to a pending entry type, ensure status is pending unless caller forces paid.
    if (!body.status && body.type && body.type !== existing.type) {
      setFields.status = "pending";
    }

    if (setFields.status === "paid" && existing.status !== "paid") {
      setFields.paidAt = new Date();
    } else if (setFields.status === "pending") {
      setFields.paidAt = null;
    }

    const history = [];
    const existingDate = new Date(existing.date).toISOString().slice(0, 10);
    const updatedDate = new Date(setFields.date).toISOString().slice(0, 10);

    if (Number(existing.amount) !== Number(setFields.amount)) {
      history.push({
        action: "amount_changed",
        message: `Amount changed from ${Number(existing.amount).toFixed(2)} to ${Number(setFields.amount).toFixed(2)} on ${eventAtText}`,
        at: eventAt,
      });
    }
    if (existingDate !== updatedDate) {
      history.push({
        action: "date_changed",
        message: `Transaction date changed from ${existingDate} to ${updatedDate} on ${eventAtText}`,
        at: eventAt,
      });
    }
    if (existing.type !== setFields.type) {
      history.push({
        action: "type_changed",
        message: `${existing.type.toUpperCase()} PENDING changed to ${setFields.type.toUpperCase()} PENDING on ${eventAtText}`,
        at: eventAt,
      });
    }
    if (existing.status !== setFields.status) {
      history.push({
        action: "status_changed",
        message:
          setFields.status === "paid"
            ? `Marked PAID on ${eventAtText}`
            : `Changed status from ${existing.status.toUpperCase()} to ${setFields.status.toUpperCase()} on ${eventAtText}`,
        at: eventAt,
      });
    }
    if (existing.currency !== setFields.currency) {
      history.push({
        action: "currency_changed",
        message: `Currency changed from ${existing.currency} to ${setFields.currency} on ${eventAtText}`,
        at: eventAt,
      });
    }
    if ((existing.notes || "") !== (setFields.notes || "")) {
      history.push({
        action: "notes_changed",
        message: `Notes updated on ${eventAtText}`,
        at: eventAt,
      });
    }
    if (existing.personId.toString() !== nextPersonId.toString()) {
      history.push({
        action: "person_changed",
        message: `Person changed from ${previousPersonName} to ${nextPersonName} on ${eventAtText}`,
        at: eventAt,
      });
    }

    history.push({
      action: "updated",
      message: `Transaction updated at ${eventAtText}`,
      at: eventAt,
    });

    const updateDoc = { $set: setFields };
    if (history.length) {
      updateDoc.$push = { changeLogs: { $each: history } };
    }

    const tx = await Transaction.findOneAndUpdate(
      { _id: id, userId: user._id, ...activeQuery() },
      updateDoc,
      { new: true }
    ).populate("personId", "name email");

    if (!tx) return fail("Transaction not found", 404);

    if (setFields.status === "paid" && existing.status !== "paid") {
      await sendPaymentReceivedMail({
        personEmail: tx.personId?.email,
        personName: tx.personId?.name,
        amount: tx.amount,
        currency: tx.currency,
      });
    }

    await clearDashboardCache(user._id);
    await logActivity(user._id, "transaction_updated", `Updated ${tx._id}`);
    return ok({ transaction: tx });
  } catch {
    return fail("Failed to update transaction", 500);
  }
}

export async function DELETE(_request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    await connectDB();
    const { deletedAt, restoreUntil } = buildBinMeta();
    const eventAt = new Date();
    const deletedAtMessage = `Transaction deleted at ${eventAt.toLocaleString()}`;

    const tx = await Transaction.findOneAndUpdate(
      { _id: id, userId: user._id, ...activeQuery() },
      {
        $set: {
          isDeleted: true,
          deletedAt,
          lastDeletedAt: eventAt,
          restoreUntil,
          deletionSource: "transaction_bin",
        },
        $push: {
          changeLogs: {
            action: "deleted",
            message: deletedAtMessage,
            at: eventAt,
          },
        },
      },
      { new: true }
    );
    if (!tx) return fail("Transaction not found", 404);

    await clearDashboardCache(user._id);
    await logActivity(user._id, "transaction_deleted", `Moved ${id} to transaction bin`);
    return ok({ message: "Transaction moved to bin" });
  } catch {
    return fail("Failed to delete transaction", 500);
  }
}
