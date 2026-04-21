import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import Person from "@/models/Person";
import { activeQuery, buildBinMeta } from "@/lib/bin";
import { clearDashboardCache } from "@/lib/redis";
import { deriveUserKey, encryptField, decryptTransaction } from "@/lib/crypto";
import { normalizeRecurringConfig, recurringLabel } from "@/lib/recurring";
import { hasActivePremium } from "@/lib/subscription";

export async function PUT(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const eventAt = new Date();
    const eventAtText = eventAt.toLocaleString();
    const recurringConfig = normalizeRecurringConfig(body);

    await connectDB();
    const existing = await Transaction.findOne({ _id: id, userId: user._id, ...activeQuery() });
    if (!existing) return fail("Transaction not found", 404);
    const premiumUser = hasActivePremium(user);
    if (recurringConfig.recurringEnabled && !premiumUser) {
      return fail("Recurring dues are available on the Pro plan", 403);
    }

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
      // Don't store plain amount - will be encrypted
      type: body.type || existing.type,
      // Don't store plain notes - will be encrypted
      currency: body.currency || existing.currency,
      date: body.date ? new Date(body.date) : existing.date,
      status: "pending",
      paidAt: null,
      recurringEnabled: recurringConfig.recurringEnabled,
      recurringFrequency: recurringConfig.recurringFrequency,
      recurringInterval: recurringConfig.recurringInterval,
      recurringEndDate: recurringConfig.recurringEndDate,
    };

    const history = [];
    const existingDate = new Date(existing.date).toISOString().slice(0, 10);
    const updatedDate = new Date(setFields.date).toISOString().slice(0, 10);

    // Derive user's encryption key early (needed for decryption comparisons)
    const userKey = await deriveUserKey(user._id.toString(), user.email);

    // Get existing amount for comparison (could be plain or encrypted)
    let existingAmount = existing.amount;
    if (existingAmount === undefined && existing.encryptedAmount) {
      try {
        const decrypted = await decryptTransaction(existing.toObject(), userKey);
        existingAmount = decrypted.amount;
      } catch (err) {
        console.error("Failed to decrypt existing amount:", err.message);
      }
    }

    // Get existing notes for comparison (could be plain or encrypted)
    let existingNotes = existing.notes || "";
    if (!existingNotes && existing.encryptedNotes) {
      try {
        const decrypted = await decryptTransaction(existing.toObject(), userKey);
        existingNotes = decrypted.notes || "";
      } catch (err) {
        console.error("Failed to decrypt existing notes:", err.message);
      }
    }

    // Check for changes
    const newAmount = body.amount != null ? Number(body.amount) : existingAmount;
    const newNotes = body.notes !== undefined ? (body.notes || "") : existingNotes;

    if (Number(existingAmount || 0) !== Number(newAmount || 0)) {
      history.push({
        action: "amount_changed",
        message: `Amount changed from ${Number(existingAmount || 0).toFixed(2)} to ${Number(newAmount || 0).toFixed(2)} on ${eventAtText}`,
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
    if (existing.status !== "pending") {
      history.push({
        action: "status_changed",
        message: `Status normalized to PENDING on ${eventAtText}`,
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
    if (existingNotes !== newNotes) {
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
    if (Boolean(existing.recurringEnabled) !== Boolean(setFields.recurringEnabled)) {
      history.push({
        action: setFields.recurringEnabled ? "recurring_enabled" : "recurring_disabled",
        message: setFields.recurringEnabled
          ? `Recurring due enabled (${recurringLabel(setFields)}) on ${eventAtText}`
          : `Recurring due disabled on ${eventAtText}`,
        at: eventAt,
      });
    } else if (setFields.recurringEnabled) {
      const existingRecurringSummary = recurringLabel(existing);
      const nextRecurringSummary = recurringLabel(setFields);
      if (existingRecurringSummary !== nextRecurringSummary) {
        history.push({
          action: "recurring_updated",
          message: `Recurring schedule changed from ${existingRecurringSummary} to ${nextRecurringSummary} on ${eventAtText}`,
          at: eventAt,
        });
      }
    }

    history.push({
      action: "updated",
      message: `Transaction updated at ${eventAtText}`,
      at: eventAt,
    });

    const updateDoc = { $set: setFields };

    // Encrypt sensitive fields - ONLY store encrypted versions
    const amountToEncrypt = body.amount != null ? Number(body.amount) : existingAmount;
    const notesToEncrypt = body.notes !== undefined ? (body.notes || "") : existingNotes;

    setFields.encryptedAmount = await encryptField(amountToEncrypt.toString(), userKey);
    setFields.encryptedNotes = await encryptField(notesToEncrypt, userKey);
    
    // Remove plain text fields from update
    updateDoc.$unset = {
      amount: "",
      notes: "",
    };

    if (history.length) {
      updateDoc.$push = { changeLogs: { $each: history } };
    }

    const tx = await Transaction.findOneAndUpdate(
      { _id: id, userId: user._id, ...activeQuery() },
      updateDoc,
      { returnDocument: "after" }
    ).populate("personId", "name email");

    if (!tx) return fail("Transaction not found", 404);
    
    // Return decrypted transaction
    const decrypted = await decryptTransaction(tx.toObject(), userKey);

    await clearDashboardCache(user._id);
    await logActivity(user._id, "transaction_updated", `Updated ${tx._id}`);
    return ok({ transaction: decrypted });
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
    const { deletedAt, restoreUntil } = buildBinMeta(user);
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
      { returnDocument: "after" }
    );
    if (!tx) return fail("Transaction not found", 404);

    await clearDashboardCache(user._id);
    await logActivity(user._id, "transaction_deleted", `Moved ${id} to transaction bin`);
    return ok({ message: "Transaction moved to bin" });
  } catch {
    return fail("Failed to delete transaction", 500);
  }
}
