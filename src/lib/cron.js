import "server-only";
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

/** Lazy import so instrumentation → cron does not pull bullmq into the Next bundle. */
async function enqueueCronJob(jobName, data) {
  try {
    const { enqueueCronJob: enqueue } = await import("@/lib/queue/producers");
    return enqueue(jobName, data);
  } catch {
    return false;
  }
}

export function startReminderCron() {
  if (started || process.env.ENABLE_CRON !== "true") return;
  started = true;

  cron.schedule("0 */12 * * *", async () => {
    try {
      await refreshExchangeRatesIfNeeded({ force: true });
    } catch (error) {
      console.error("Exchange rate refresh failed:", error);
    }
  });

  cron.schedule("0 9 * * *", async () => {
    await connectDB();
    const users = await User.find({}).select("_id").lean();

    let dispatched = false;
    for (const u of users) {
      const userId = u._id.toString();
      const a = await enqueueCronJob("user-daily-notifications", { userId });
      const b = await enqueueCronJob("user-bin-cleanup", { userId });
      const c = await enqueueCronJob("user-reminder-emails", { userId });
      if (a && b && c) dispatched = true;
    }

    if (dispatched) return;

    const fullUsers = await User.find({});
    for (const user of fullUsers) {
      if (user.notificationsEnabled !== false) {
        await generateDailyNotificationsForUser(user._id);
      }

      const shouldSend =
        user.reminderFrequency === "daily" ||
        (user.reminderFrequency === "weekly" && new Date().getDay() === 1) ||
        (user.reminderFrequency === "monthly" && new Date().getDate() === 1);

      if (!shouldSend) continue;

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

  cron.schedule("*/15 * * * *", async () => {
    try {
      await connectDB();
      const now = new Date();
      const RETENTION_DAYS = 7;

      const windows = [
        { key: "threeDays", ms: 3 * 24 * 60 * 60 * 1000, label: "3 days" },
        { key: "threeHours", ms: 3 * 60 * 60 * 1000, label: "3 hours" },
        { key: "oneHour", ms: 1 * 60 * 60 * 1000, label: "1 hour" },
      ];
      const WINDOW = 10 * 60 * 1000;

      for (const { key, ms, label } of windows) {
        const low = new Date(now.getTime() + ms - WINDOW);
        const high = new Date(now.getTime() + ms + WINDOW);

        const filter = { isDeleted: false, startTime: { $gte: low, $lte: high } };
        filter[`notifiedAt.${key}`] = false;

        const events = await Event.find(filter).select("_id").lean();

        let allDispatched = true;
        for (const event of events) {
          const ok = await enqueueCronJob("event-reminders", {
            eventId: event._id.toString(),
            key,
            label,
          });
          if (!ok) { allDispatched = false; break; }
        }

        if (!allDispatched) {
          const fullEvents = await Event.find(filter).lean();
          for (const event of fullEvents) {
            const expiresAt = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
            await Notification.create({
              userId: event.userId,
              type: "event_reminder",
              title: `Upcoming event: ${event.title}`,
              message: `"${event.title}" starts in ${label} (${new Date(event.startTime).toLocaleString()}).${event.location ? ` Location: ${event.location}` : ""}`,
              meta: { eventId: event._id.toString(), threshold: key },
              expiresAt,
            });
            await Event.updateOne({ _id: event._id }, { $set: { [`notifiedAt.${key}`]: true } });
            await publishNotificationEvent(event.userId.toString(), "created").catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error("Event notification cron error:", err);
    }
  });
}
