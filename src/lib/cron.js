import cron from "node-cron";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Person from "@/models/Person";
import Transaction from "@/models/Transaction";
import { sendMail } from "@/lib/mailer";
import { activeQuery } from "@/lib/bin";
import { refreshExchangeRatesIfNeeded } from "@/lib/exchangeRates";
import { generateDailyNotificationsForUser } from "@/lib/notifications";

let started = false;

export function startReminderCron() {
  if (started || process.env.ENABLE_CRON !== "true") return;
  started = true;

  // Refresh currency rates at most twice a day to respect provider limits.
  cron.schedule("0 */12 * * *", async () => {
    try {
      await refreshExchangeRatesIfNeeded({ force: true });
    } catch (error) {
      console.error("Exchange rate refresh failed:", error);
    }
  });

  cron.schedule("0 9 * * *", async () => {
    await connectDB();
    const users = await User.find({});

    for (const user of users) {
      if (user.notificationsEnabled !== false) {
        await generateDailyNotificationsForUser(user._id);
      }

      const shouldSend =
        user.reminderFrequency === "daily" ||
        (user.reminderFrequency === "weekly" && new Date().getDay() === 1) ||
        (user.reminderFrequency === "monthly" && new Date().getDate() === 1);

      if (!shouldSend) continue;

      // Permanent cleanup for expired bin records.
      await Person.deleteMany({ userId: user._id, isDeleted: true, restoreUntil: { $lt: new Date() } });
      await Transaction.deleteMany({ userId: user._id, isDeleted: true, restoreUntil: { $lt: new Date() } });

      const pending = await Transaction.find({ userId: user._id, status: "pending", ...activeQuery() });
      if (!pending.length) continue;

      const people = await Person.find({ userId: user._id, ...activeQuery() });
      const peopleById = new Map(people.map((p) => [p._id.toString(), p]));

      for (const p of pending) {
        const person = peopleById.get(p.personId.toString());
        if (!person?.email) continue;

        await sendMail({
          to: person.email,
          subject: "Pending due reminder",
          headline: "Pending due notification",
          message: `A pending ${p.type} transaction of ${p.amount} ${p.currency} is still open with ${user.name}.`,
        });
      }
    }
  });
}
