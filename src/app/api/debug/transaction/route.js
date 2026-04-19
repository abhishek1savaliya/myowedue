import { connectDB } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import { deriveUserKey, decryptField, decryptTransaction } from "@/lib/crypto";

export async function GET(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    await connectDB();

    // Get one transaction
    const tx = await Transaction.findOne({ userId: user._id }).select({
      amount: 1,
      encryptedAmount: 1,
      notes: 1,
      encryptedNotes: 1,
      userId: 1,
      createdAt: 1,
    });

    if (!tx) {
      return ok({ message: "No transactions found" });
    }

    const plain = tx.toObject();
    
    console.log("=== DEBUG: Transaction in Database ===");
    console.log("ID:", tx._id);
    console.log("plain.amount:", plain.amount);
    console.log("plain.encryptedAmount exists:", !!plain.encryptedAmount);
    console.log("encryptedAmount preview:", plain.encryptedAmount?.slice(0, 50));
    console.log("plain.notes:", plain.notes);
    console.log("plain.encryptedNotes exists:", !!plain.encryptedNotes);

    // Try to derive key
    console.log("\n=== DEBUG: Key Derivation ===");
    console.log("User ID:", user._id.toString());
    console.log("User Email:", user.email);

    const userKey = await deriveUserKey(user._id.toString(), user.email);
    console.log("Derived key (first 16 bytes):", Buffer.from(userKey.slice(0, 16)).toString("hex"));

    // Try to decrypt amount
    console.log("\n=== DEBUG: Decryption Attempt ===");
    let decryptedAmount = null;
    let amountError = null;

    if (plain.encryptedAmount) {
      try {
        decryptedAmount = await decryptField(plain.encryptedAmount, userKey);
        console.log("✓ Amount decrypted:", decryptedAmount);
      } catch (err) {
        amountError = err.message;
        console.error("✗ Amount decryption failed:", err.message);
      }
    }

    // Try full transaction decryption
    let decryptedTx = null;
    let txError = null;

    try {
      decryptedTx = await decryptTransaction(plain, userKey);
      console.log("✓ Transaction decrypted");
      console.log("  amount:", decryptedTx.amount);
      console.log("  notes:", decryptedTx.notes);
    } catch (err) {
      txError = err.message;
      console.error("✗ Transaction decryption failed:", err.message);
    }

    return ok({
      debug: {
        transactionId: tx._id,
        database: {
          hasAmount: plain.amount !== undefined,
          amount: plain.amount,
          hasEncryptedAmount: !!plain.encryptedAmount,
          encryptedAmountPreview: plain.encryptedAmount?.slice(0, 50),
          hasNotes: plain.notes !== undefined,
          notes: plain.notes,
          hasEncryptedNotes: !!plain.encryptedNotes,
          encryptedNotesPreview: plain.encryptedNotes?.slice(0, 50),
        },
        user: {
          id: user._id.toString(),
          email: user.email,
        },
        decryption: {
          amountDecrypted: decryptedAmount,
          amountError,
          transactionDecrypted: {
            amount: decryptedTx?.amount,
            notes: decryptedTx?.notes,
          },
          transactionError: txError,
        },
      },
    });
  } catch (error) {
    console.error("Debug endpoint error:", error);
    return fail(error.message,  500);
  }
}
