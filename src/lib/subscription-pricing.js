import { DEFAULT_FX, formatCurrency } from "@/lib/currency";

/** Base plan prices are defined in USD. */
export const SUBSCRIPTION_PRICE_USD = {
  monthly: 7,
  yearly: 70,
  yearlyStrike: 84,
};

export const SUBSCRIPTION_CURRENCIES = ["USD", "AUD", "INR", "EUR", "GBP"];

export function isSubscriptionCurrency(code) {
  return SUBSCRIPTION_CURRENCIES.includes(String(code || "").toUpperCase());
}

export function normalizeSubscriptionCurrency(code, fallback = "USD") {
  const normalized = String(code || fallback).toUpperCase();
  return isSubscriptionCurrency(normalized) ? normalized : fallback;
}

function getRate(currency, rates) {
  const code = normalizeSubscriptionCurrency(currency);
  return Number(rates?.[code] ?? DEFAULT_FX[code] ?? 1);
}

export function convertSubscriptionFromUsd(usdAmount, currency, rates) {
  const amount = Number(usdAmount || 0);
  return amount * getRate(currency, rates);
}

export function roundSubscriptionAmount(amount, currency) {
  const code = normalizeSubscriptionCurrency(currency);
  if (code === "INR") return Math.round(amount);
  return Math.round(amount * 100) / 100;
}

export function getSubscriptionPriceBundle(currency, rates) {
  const code = normalizeSubscriptionCurrency(currency);
  const monthly = roundSubscriptionAmount(
    convertSubscriptionFromUsd(SUBSCRIPTION_PRICE_USD.monthly, code, rates),
    code
  );
  const yearly = roundSubscriptionAmount(
    convertSubscriptionFromUsd(SUBSCRIPTION_PRICE_USD.yearly, code, rates),
    code
  );
  const yearlyStrike = roundSubscriptionAmount(
    convertSubscriptionFromUsd(SUBSCRIPTION_PRICE_USD.yearlyStrike, code, rates),
    code
  );
  const yearlyMonthlyEq = roundSubscriptionAmount(yearly / 12, code);
  const savingsPct = Math.round(
    (1 - SUBSCRIPTION_PRICE_USD.yearly / SUBSCRIPTION_PRICE_USD.yearlyStrike) * 100
  );

  return { currency: code, monthly, yearly, yearlyStrike, yearlyMonthlyEq, savingsPct };
}

export function getSubscriptionCharge(plan, currency, rates, { voucherApplied = false } = {}) {
  if (plan !== "pro_monthly" && plan !== "pro_yearly") return 0;
  if (voucherApplied) return 0;
  const code = normalizeSubscriptionCurrency(currency);
  const usd =
    plan === "pro_yearly" ? SUBSCRIPTION_PRICE_USD.yearly : SUBSCRIPTION_PRICE_USD.monthly;
  return roundSubscriptionAmount(convertSubscriptionFromUsd(usd, code, rates), code);
}

export function formatSubscriptionPrice(amount, currency) {
  return formatCurrency(amount, normalizeSubscriptionCurrency(currency));
}
