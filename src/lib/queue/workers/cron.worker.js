import "server-only";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Person from "@/models/Person";
import Transaction from "@/models/Transaction";
import Event from "@/models/Event";
import Notification from "@/models/Notification";
import { sendMail } from "@/lib/mailer";
import { activeQuery } from "@/lib/bin";
import { generateDailyNotificationsForUser } from "@/lib/notifications";
import { publishNotificationEvent } from "@/lib/redis";

export const CRON_QUEUE_NAME = "cron-fanout";
export const CRON_CONCURRENCY = 10;

export async function cronProcessor(job) {
  await connectDB();

  switch (job.name) {
    case "user-daily-notifications":
      return handleDailyNotifications(job.data);
    case "user-bin-cleanup":
      return handleBinCleanup(job.data);
    case "user-reminder-emails":
      return handleReminderEmails(job.data);
    case "event-reminders":
      return handleEventReminders(job.data);
    default:
      throw new Error(`Unknown cron job: ${job.name}`);
  }
}

async function handleDailyNotifications({ userId }) {
  const user = await User.findById(userId);
  if (!user || user.notificationsEnabled === false) return { skipped: true };
  await generateDailyNotificationsForUser(user._id);
  return { processed: true };
}

async function handleBinCleanup({ userId }) {
  const now = new Date();
  const [deletedPeople, deletedTx] = await Promise.all([
    Person.deleteMany({ userId, isDeleted: true, restoreUntil: { $lt: now } }),
    Transaction.deleteMany({ userId, isDeleted: true, restoreUntil: { $lt: now } }),
  ]);
  return {
    deletedPeople: deletedPeople.deletedCount || 0,
    deletedTransactions: deletedTx.deletedCount || 0,
  };
}

async function handleReminderEmails({ userId }) {
  const user = await User.findById(userId);
  if (!user) return { skipped: true };

  const shouldSend =
    user.reminderFrequency === "daily" ||
    (user.reminderFrequency === "weekly" && new Date().getDay() === 1) ||
    (user.reminderFrequency === "monthly" && new Date().getDate() === 1);

  if (!shouldSend) return { skipped: true };

  const pending = await Transaction.find({ userId: user._id, status: "pending", ...activeQuery() });
  if (!pending.length) return { skipped: true, reason: "no pending" };

  const people = await Person.find({ userId: user._id, ...activeQuery() });
  const peopleById = new Map(people.map((p) => [p._id.toString(), p]));

  let sent = 0;
  for (const p of pending) {
    const person = peopleById.get(p.personId.toString());
    if (!person?.email) continue;

    await sendMail({
      to: person.email,
      subject: "Pending due reminder",
      headline: "Pending due notification",
      message: `A pending ${p.type} transaction of ${p.amount} ${p.currency} is still open with ${user.name}.`,
    });
    sent++;
  }
  return { sent };
}

async function handleEventReminders({ eventId, key, label }) {
  const now = new Date();
  const RETENTION_DAYS = 7;

  const event = await Event.findById(eventId).lean();
  if (!event || event.isDeleted) return { skipped: true };

  if (event.notifiedAt?.[key]) return { skipped: true, reason: "already notified" };

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
  return { notified: true };
}
