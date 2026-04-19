import { connectDB } from "@/lib/db";
import { activeQuery } from "@/lib/bin";
import ExchangeRate from "@/models/ExchangeRate";
import Transaction from "@/models/Transaction";
import User from "@/models/User";
import Notification from "@/models/Notification";
import { publishNotificationEvent } from "@/lib/redis";

const MAX_NOTIFICATIONS_PER_DAY = 3;
const NOTIFICATION_RETENTION_DAYS = 7;
const FX_SPIKE_THRESHOLD_PCT = 0.7;

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function expiryDate(date = new Date()) {
  return new Date(date.getTime() + NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

function formatPct(value) {
  return Number(value || 0).toFixed(2);
}

function getFxSpikeCandidate(latest, previous) {
  if (!latest?.rates || !previous?.rates) return null;

  const latestRates = typeof latest.rates?.get === "function" ? Object.fromEntries(latest.rates.entries()) : latest.rates;
  const previousRates = typeof previous.rates?.get === "function" ? Object.fromEntries(previous.rates.entries()) : previous.rates;

  let best = null;
  for (const currency of Object.keys(latestRates || {})) {
    if (currency === "USD") continue;
    const nowRate = Number(latestRates[currency] || 0);
    const prevRate = Number(previousRates[currency] || 0);
    if (!nowRate || !prevRate) continue;

    const pct = ((nowRate - prevRate) / prevRate) * 100;
    if (pct <= 0) continue;
    if (!best || pct > best.pct) {
      best = { currency, pct, nowRate, prevRate };
    }
  }

  if (!best || best.pct < FX_SPIKE_THRESHOLD_PCT) return null;

  return {
    type: "fx_spike",
    title: `USD moved up vs ${best.currency}`,
    message: `USD increased ${formatPct(best.pct)}% against ${best.currency} (from ${best.prevRate.toFixed(4)} to ${best.nowRate.toFixed(4)}).`,
    meta: {
      currency: best.currency,
      pct: Number(best.pct.toFixed(4)),
      previousRate: best.prevRate,
      currentRate: best.nowRate,
    },
  };
}

export async function generateDailyNotificationsForUser(userId) {
  await connectDB();

  const user = await User.findById(userId).select("notificationsEnabled notificationGeneration").lean();
  if (!user || user.notificationsEnabled === false) return 0;

  const now = new Date();
  const today = dayKey(now);
  const sixMonthsAgo = new Date(now.getTime());
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  await Notification.deleteMany({ userId, expiresAt: { $lt: now } });

  const generation = user.notificationGeneration || {};
  const generatedTodayCount = generation.day === today ? Number(generation.count || 0) : 0;
  const generatedTodayTypes = new Set(
    generation.day === today && Array.isArray(generation.types) ? generation.types : []
  );
  const remainingSlots = Math.max(0, MAX_NOTIFICATIONS_PER_DAY - generatedTodayCount);
  if (remainingSlots <= 0) return 0;

  const candidates = [];
  const latestRates = await ExchangeRate.find({ base: "USD" }).sort({ fetchedAt: -1 }).limit(2).lean();
  if (!generatedTodayTypes.has("fx_spike") && latestRates.length >= 2) {
    const fxCandidate = getFxSpikeCandidate(latestRates[0], latestRates[1]);
    if (fxCandidate) candidates.push(fxCandidate);
  }

  if (!generatedTodayTypes.has("long_due")) {
    const oldestDue = await Transaction.findOne({
      userId,
      status: "pending",
      date: { $lte: sixMonthsAgo },
      ...activeQuery(),
    })
      .populate("personId", "name")
      .sort({ date: 1 })
      .lean();

    if (oldestDue?.personId?.name) {
      candidates.push({
        type: "long_due",
        title: "Long pending due",
        message: `${oldestDue.personId.name} has a pending due older than 6 months (${new Date(oldestDue.date).toLocaleDateString()}).`,
        meta: {
          personId: String(oldestDue.personId._id || ""),
          personName: oldestDue.personId.name,
          transactionId: String(oldestDue._id),
        },
      });
    }
  }

  if (!generatedTodayTypes.has("pending_insight")) {
    const pendingCount = await Transaction.countDocuments({
      userId,
      status: "pending",
      ...activeQuery(),
    });

    if (pendingCount >= 5) {
      candidates.push({
        type: "pending_insight",
        title: "Pending volume insight",
        message: `You currently have ${pendingCount} pending transactions. Consider settling the oldest ones first.`,
        meta: { pendingCount },
      });
    }
  }

  const toInsert = candidates.slice(0, remainingSlots).map((item) => ({
    ...item,
    userId,
    expiresAt: expiryDate(now),
  }));

  if (toInsert.length === 0) {
    return 0;
  }

  await Notification.insertMany(toInsert);

  const nextTypes = Array.from(new Set([...generatedTodayTypes, ...toInsert.map((item) => item.type)]));

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        notificationGeneration: {
          day: today,
          count: generatedTodayCount + toInsert.length,
          types: nextTypes,
        },
      },
    }
  );

  await publishNotificationEvent(userId, "created");
  return toInsert.length;
}