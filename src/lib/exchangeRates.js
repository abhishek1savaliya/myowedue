import { connectDB } from "@/lib/db";
import ExchangeRate from "@/models/ExchangeRate";
import { DEFAULT_FX } from "@/lib/currency";

const EXCHANGE_RATE_URL = "https://api.exchangeratesapi.io/v1/latest";
const TARGET_SYMBOLS = ["USD", "AUD", "INR", "EUR", "GBP"];
const BASE = "USD";

let refreshPromise = null;

function toPlainRates(mapLike) {
  if (!mapLike) return null;
  if (typeof mapLike.get === "function") {
    return Object.fromEntries(mapLike.entries());
  }
  return { ...mapLike };
}

function buildUsdRatesFromEuroBased(responseRates) {
  const eurToUsd = Number(responseRates?.USD || 0);
  if (!eurToUsd) return null;

  const usdRates = { USD: 1 };
  for (const symbol of TARGET_SYMBOLS) {
    if (symbol === "USD") continue;
    const eurToTarget = Number(responseRates?.[symbol] || 0);
    if (!eurToTarget) continue;
    usdRates[symbol] = eurToTarget / eurToUsd;
  }

  return usdRates;
}

async function fetchRatesFromProvider() {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing EXCHANGE_RATE_API_KEY");
  }

  const params = new URLSearchParams({
    access_key: apiKey,
    symbols: TARGET_SYMBOLS.join(","),
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  let response;
  try {
    response = await fetch(`${EXCHANGE_RATE_URL}?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Exchange API request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Exchange API request failed (${response.status})`);
  }

  const payload = await response.json();
  if (!payload?.rates) {
    throw new Error("Exchange API did not return rates");
  }

  const rates = buildUsdRatesFromEuroBased(payload.rates);
  if (!rates || !rates.USD) {
    throw new Error("Failed to normalize exchange rates to USD base");
  }

  return rates;
}

export async function getLatestUsdRatesFromDB() {
  await connectDB();
  const latest = await ExchangeRate.findOne({ base: BASE }).sort({ fetchedAt: -1 }).lean();
  if (!latest?.rates) return null;
  return {
    rates: toPlainRates(latest.rates),
    fetchedAt: latest.fetchedAt,
  };
}

export async function refreshExchangeRatesIfNeeded({ maxAgeHours = 12, force = false } = {}) {
  if (!force) {
    const latest = await getLatestUsdRatesFromDB();
    if (latest?.fetchedAt) {
      const ageMs = Date.now() - new Date(latest.fetchedAt).getTime();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      if (ageMs < maxAgeMs) return latest.rates;
    }
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    await connectDB();
    const rates = await fetchRatesFromProvider();
    await ExchangeRate.create({
      base: BASE,
      rates,
      fetchedAt: new Date(),
      provider: "exchangeratesapi",
    });
    return rates;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function getUsdRatesForUsage({ maxAgeHours = 12 } = {}) {
  try {
    const rates = await refreshExchangeRatesIfNeeded({ maxAgeHours });
    return rates;
  } catch {
    const latest = await getLatestUsdRatesFromDB();
    if (latest?.rates) return latest.rates;
    return { ...DEFAULT_FX };
  }
}
