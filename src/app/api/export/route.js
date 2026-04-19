import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import { ok } from "@/lib/api";
import { activeQuery } from "@/lib/bin";
import { deriveUserKey, decryptTransaction } from "@/lib/crypto";

export async function GET(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  await connectDB();
  const tx = await Transaction.find({ userId: user._id, ...activeQuery() }).populate("personId", "name");

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (type === "csv") {
    const userKey = await deriveUserKey(user._id.toString(), user.email);
    const rows = ["person,amount,type,currency,status,date,notes"];
    
    for (const t of tx) {
      // Decrypt transaction to get actual amount and notes
      let decryptedAmount = t.amount || "";
      let decryptedNotes = t.notes || "";

      if (t.encryptedAmount || t.encryptedNotes) {
        try {
          const decrypted = await decryptTransaction(t.toObject(), userKey);
          decryptedAmount = decrypted.amount || "";
          decryptedNotes = decrypted.notes || "";
        } catch (err) {
          console.error(`Failed to decrypt transaction ${t._id}:`, err.message);
        }
      }

      rows.push(
        [
          `"${(t.personId?.name || "Unknown").replace(/"/g, '""')}"`,
          decryptedAmount,
          t.type,
          t.currency,
          t.status,
          new Date(t.date).toISOString(),
          `"${(decryptedNotes || "").replace(/"/g, '""')}"`,
        ].join(",")
      );
    }

    return new Response(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=transactions.csv",
      },
    });
  }

  return ok({ transactions: tx });
}
