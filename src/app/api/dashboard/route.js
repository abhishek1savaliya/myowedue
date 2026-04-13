import { connectDB } from "@/lib/db";
import { ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import Person from "@/models/Person";
import { activeQuery } from "@/lib/bin";
import { dashboardCacheKey, getRedisJSON, setRedisJSON } from "@/lib/redis";
import { convertFromUSD, normalizeCurrency } from "@/lib/currency";
import { getLatestUsdRatesFromDB, getUsdRatesForUsage } from "@/lib/exchangeRates";

const DEFAULT_DASHBOARD_CURRENCY = "AUD";
const ALLOWED_CURRENCIES = new Set(["USD", "AUD", "INR", "EUR", "GBP"]);

function resolveCurrency(rawCurrency) {
  const normalized = String(rawCurrency || DEFAULT_DASHBOARD_CURRENCY).toUpperCase();
  return ALLOWED_CURRENCIES.has(normalized) ? normalized : DEFAULT_DASHBOARD_CURRENCY;
}

function toDashboardCurrency(amount, currency, targetCurrency, usdRates) {
  const inUSD = normalizeCurrency(Number(amount || 0), currency || "USD", usdRates);
  return convertFromUSD(inUSD, targetCurrency, usdRates);
}

export async function GET(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const dashboardCurrency = resolveCurrency(searchParams.get("currency"));

  const cacheKey = dashboardCacheKey(user._id, dashboardCurrency);
  const cached = await getRedisJSON(cacheKey);
  if (cached) {
    return ok(cached);
  }

  await connectDB();

  const [transactions, people] = await Promise.all([
    Transaction.find({ userId: user._id, ...activeQuery() }).populate("personId", "name"),
    Person.find({ userId: user._id, ...activeQuery() }),
  ]);
  const [usdRates, latestRateEntry] = await Promise.all([
    getUsdRatesForUsage({ maxAgeHours: 12 }),
    getLatestUsdRatesFromDB(),
  ]);

  let totalGiven = 0;
  let totalReceivedBack = 0;
  let pendingNet = 0;
  const pending = [];
  const monthlyMap = new Map();
  const personMap = new Map();

  for (const tx of transactions) {
    if (tx.status !== "pending") continue;

    const amountInDashboardCurrency = toDashboardCurrency(
      tx.amount,
      tx.currency,
      dashboardCurrency,
      usdRates
    );

    if (tx.type === "credit") totalGiven += amountInDashboardCurrency;
    if (tx.type === "debit") totalReceivedBack += amountInDashboardCurrency;

    const txData = tx.toObject();
    txData.amountInDashboardCurrency = amountInDashboardCurrency;
    txData.signedAmountInDashboardCurrency =
      tx.type === "credit" ? -amountInDashboardCurrency : amountInDashboardCurrency;
    pending.push(txData);
    pendingNet += txData.signedAmountInDashboardCurrency;

    const monthKey = new Date(tx.date).toISOString().slice(0, 7);
    const currentMonth = monthlyMap.get(monthKey) || { credit: 0, debit: 0 };
    currentMonth[tx.type] += amountInDashboardCurrency;
    monthlyMap.set(monthKey, currentMonth);

    const personName = tx.personId?.name || "Unknown";
    const currentPerson = personMap.get(personName) || { credit: 0, debit: 0 };
    currentPerson[tx.type] += amountInDashboardCurrency;
    personMap.set(personName, currentPerson);
  }

  const payload = {
    totals: { totalGiven, totalReceivedBack },
    recent: pending.slice(0, 8),
    pending: pending.slice(0, 12),
    paid: [],
    monthlyInsights: Array.from(monthlyMap.entries()).map(([month, value]) => ({ month, ...value })),
    personInsights: Array.from(personMap.entries()).map(([person, value]) => ({ person, ...value })),
    notificationCount: pending.length,
    peopleCount: people.length,
    pendingNet,
    currency: dashboardCurrency,
    usdToSelectedRate: Number(usdRates?.[dashboardCurrency] || 1),
    ratesUpdatedAt: latestRateEntry?.fetchedAt || null,
  };

  await setRedisJSON(cacheKey, payload, 90);
  return ok(payload);
}
