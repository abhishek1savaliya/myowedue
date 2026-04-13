export const DEFAULT_FX = {
  USD: 1,      // Base Currency
  AUD: 1.42,   // Down from 1.52
  INR: 93.31,  // Up from 83.2
  EUR: 0.86,   // Down from 0.93
  GBP: 0.74,   // Down from 0.79
};

function getRate(currency, rates) {
  const table = rates || DEFAULT_FX;
  return Number(table?.[currency] || 1);
}

export function normalizeCurrency(amount, currency = "USD", rates) {
  const rate = getRate(currency, rates);
  return amount / rate;
}

export function formatCurrency(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

export function convertFromUSD(amount, currency = "USD", rates) {
  const rate = getRate(currency, rates);
  return amount * rate;
}
