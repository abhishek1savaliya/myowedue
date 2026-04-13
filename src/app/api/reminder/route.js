import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import { sendDueReminderToPerson } from "@/lib/reminders";
import { sendMail } from "@/lib/mailer";
import { activeQuery } from "@/lib/bin";

export async function POST(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { personId } = await request.json();
    if (!personId) return fail("personId is required", 422);

    await connectDB();
    const result = await sendDueReminderToPerson({ user, personId });
    if (!result.ok) return fail(result.message, 400);

    return ok({ message: "Reminder sent" });
  } catch {
    return fail("Failed to send reminder", 500);
  }
}

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  await connectDB();
  const pending = await Transaction.find({ userId: user._id, status: "pending", ...activeQuery() });
  const pendingAmount = pending.reduce(
    (sum, tx) => sum + (tx.type === "credit" ? -Number(tx.amount || 0) : Number(tx.amount || 0)),
    0
  );

  if (user.email) {
    await sendMail({
      to: user.email,
      subject: "Your pending dues summary",
      headline: "Pending dues overview",
      message: `You currently have ${pending.length} pending entries with net pending due ${pendingAmount.toFixed(2)} across all currencies.`,
    });
  }

  return ok({ message: "Summary email sent", count: pending.length, pendingAmount });
}
