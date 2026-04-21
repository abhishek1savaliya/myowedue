import cron from "node-cron";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Person from "@/models/Person";
import Transaction from "@/models/Transaction";
import Event from "@/models/Event";
import Notification from "@/models/Notification";
import { sendMail } from "@/lib/mailer";
import { activeQuery } from "@/lib/bin";
import { refreshExchangeRatesIfNeeded } from "@/lib/exchangeRates";
import { generateDailyNotificationsForUser } from "@/lib/notifications";
import { publishNotificationEvent } from "@/lib/redis";

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

  // Every 15 minutes: check for upcoming events and send notifications.
  // Notification schedule: 3 days before, 3 hours before, 1 hour before.
  cron.schedule("*/15 * * * *", async () => {
    try {
      await connectDB();
      const now = new Date();
      const RETENTION_DAYS = 7;

      // Windows (in ms) around each threshold — ±10 min to tolerate cron drift
      const windows = [
        { key: "threeDays",  ms: 3 * 24 * 60 * 60 * 1000, label: "3 days" },
        { key: "threeHours", ms: 3 * 60 * 60 * 1000,       label: "3 hours" },
        { key: "oneHour",    ms: 1 * 60 * 60 * 1000,        label: "1 hour" },
      ];
      const WINDOW = 10 * 60 * 1000; // ±10 minutes

      for (const { key, ms, label } of windows) {
        const low  = new Date(now.getTime() + ms - WINDOW);
        const high = new Date(now.getTime() + ms + WINDOW);

        const filter = { isDeleted: false, startTime: { $gte: low, $lte: high } };
        filter[`notifiedAt.${key}`] = false;

        const events = await Event.find(filter).lean();
        for (const event of events) {
          // Create in-app notification
          const expiresAt = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
          await Notification.create({
            userId: event.userId,
            type: "event_reminder",
            title: `Upcoming event: ${event.title}`,
            message: `"${event.title}" starts in ${label} (${new Date(event.startTime).toLocaleString()}).${event.location ? ` Location: ${event.location}` : ""}`,
            meta: { eventId: event._id.toString(), threshold: key },
            expiresAt,
          });

          // Mark this threshold as notified
          await Event.updateOne({ _id: event._id }, { $set: { [`notifiedAt.${key}`]: true } });

          // Push real-time update
          await publishNotificationEvent(event.userId.toString(), "created").catch(() => {});
        }
      }
    } catch (err) {
      console.error("Event notification cron error:", err);
    }
  });
}
