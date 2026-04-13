import { formatCurrency } from "@/lib/currency";
import { sendMail } from "@/lib/mailer";
import Transaction from "@/models/Transaction";
import Person from "@/models/Person";
import { activeQuery } from "@/lib/bin";

export async function sendDueReminderToPerson({ user, personId }) {
  const person = await Person.findOne({ _id: personId, userId: user._id, ...activeQuery() });
  if (!person?.email) {
    return { ok: false, message: "Person email is missing" };
  }

  const tx = await Transaction.find({
    userId: user._id,
    personId,
    status: "pending",
    ...activeQuery(),
  });

  const total = tx.reduce((sum, item) => {
    const signed = item.type === "credit" ? -item.amount : item.amount;
    return sum + signed;
  }, 0);

  const subject = total <= 0 ? "Payment Reminder" : "Amount I Owe You";
  const headline = total <= 0 ? `${person.name} owes ${user.name}` : `${user.name} owes ${person.name}`;
  const message = `Current outstanding amount is ${formatCurrency(Math.abs(total), tx[0]?.currency || "USD")}. Please review and confirm payment status.`;

  return sendMail({ to: person.email, subject, headline, message });
}

export async function sendPaymentReceivedMail({ personEmail, personName, amount, currency }) {
  if (!personEmail) return { ok: false, message: "No recipient email" };

  return sendMail({
    to: personEmail,
    subject: "Payment Received",
    headline: "Payment received successfully",
    message: `Hi ${personName}, payment of ${formatCurrency(amount, currency)} has been marked as received.`,
  });
}
