import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import { ok } from "@/lib/api";
import { activeQuery } from "@/lib/bin";

export async function GET(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  await connectDB();
  const tx = await Transaction.find({ userId: user._id, ...activeQuery() }).populate("personId", "name");

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (type === "csv") {
    const rows = ["person,amount,type,currency,status,date,notes"];
    for (const t of tx) {
      rows.push(
        [
          `"${(t.personId?.name || "Unknown").replace(/"/g, '""')}"`,
          t.amount,
          t.type,
          t.currency,
          t.status,
          new Date(t.date).toISOString(),
          `"${(t.notes || "").replace(/"/g, '""')}"`,
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
