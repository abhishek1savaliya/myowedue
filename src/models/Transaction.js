import mongoose, { Schema } from "mongoose";

const TransactionChangeLogSchema = new Schema(
  {
    action: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const TransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    personId: { type: Schema.Types.ObjectId, ref: "Person", required: true, index: true },
    amount: { type: Number, min: 0 }, // Optional - we store encryptedAmount instead
    encryptedAmount: { type: String, trim: true }, // Stores encrypted amount
    encryptedNotes: { type: String, trim: true }, // Stores encrypted notes
    type: { type: String, enum: ["credit", "debit"], required: true },
    currency: { type: String, default: "USD", trim: true },
    status: { type: String, enum: ["pending", "paid"], default: "pending" },
    notes: { type: String, trim: true }, // Optional - we store encryptedNotes instead
    date: { type: Date, required: true },
    paidAt: { type: Date },
    lastDeletedAt: { type: Date },
    lastRestoredAt: { type: Date },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    restoreUntil: { type: Date },
    deletionSource: { type: String, enum: ["person_bin", "transaction_bin"], default: "transaction_bin" },
    changeLogs: { type: [TransactionChangeLogSchema], default: [] },
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, isDeleted: 1, date: -1, createdAt: -1 });
TransactionSchema.index({ userId: 1, personId: 1, isDeleted: 1, date: -1 });
TransactionSchema.index({ userId: 1, status: 1, type: 1, isDeleted: 1, date: -1 });

let Transaction;

if (mongoose.models.Transaction) {
  Transaction = mongoose.models.Transaction;

  const missingPaths = {};
  if (!Transaction.schema.path("changeLogs")) {
    missingPaths.changeLogs = { type: [TransactionChangeLogSchema], default: [] };
  }
  if (!Transaction.schema.path("lastDeletedAt")) {
    missingPaths.lastDeletedAt = { type: Date };
  }
  if (!Transaction.schema.path("lastRestoredAt")) {
    missingPaths.lastRestoredAt = { type: Date };
  }
  if (!Transaction.schema.path("encryptedAmount")) {
    missingPaths.encryptedAmount = { type: String, trim: true };
  }
  if (!Transaction.schema.path("encryptedNotes")) {
    missingPaths.encryptedNotes = { type: String, trim: true };
  }

  if (Object.keys(missingPaths).length > 0) {
    Transaction.schema.add(missingPaths);
  }
} else {
  Transaction = mongoose.model("Transaction", TransactionSchema);
}

export default Transaction;
