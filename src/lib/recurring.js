const ALLOWED_FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"];

export function isValidRecurringFrequency(value) {
  return ALLOWED_FREQUENCIES.includes(value);
}

export function normalizeRecurringConfig(input = {}) {
  const enabled = Boolean(input.recurringEnabled);
  if (!enabled) {
    return {
      recurringEnabled: false,
      recurringFrequency: null,
      recurringInterval: 1,
      recurringEndDate: null,
    };
  }

  const frequency = String(input.recurringFrequency || "monthly").toLowerCase();
  const interval = Math.max(1, Number.parseInt(String(input.recurringInterval || "1"), 10) || 1);
  const recurringEndDate = input.recurringEndDate ? new Date(input.recurringEndDate) : null;

  return {
    recurringEnabled: true,
    recurringFrequency: isValidRecurringFrequency(frequency) ? frequency : "monthly",
    recurringInterval: interval,
    recurringEndDate:
      recurringEndDate && !Number.isNaN(recurringEndDate.getTime()) ? recurringEndDate : null,
  };
}

export function recurringLabel(transaction) {
  if (!transaction?.recurringEnabled || !transaction?.recurringFrequency) return "One-time due";
  const every = Number(transaction.recurringInterval || 1);
  const frequency = String(transaction.recurringFrequency || "monthly");
  const unit = every === 1 ? frequency.replace(/ly$/, "") : frequency.replace(/ly$/, "");
  const prefix = every === 1 ? `Every ${unit}` : `Every ${every} ${unit}s`;
  if (transaction.recurringEndDate) {
    return `${prefix} until ${new Date(transaction.recurringEndDate).toLocaleDateString()}`;
  }
  return prefix;
}

export function nextRecurringDate(dateValue, frequency, interval = 1) {
  const base = new Date(dateValue);
  if (Number.isNaN(base.getTime())) return null;

  const next = new Date(base);
  const amount = Math.max(1, Number(interval || 1));

  switch (frequency) {
    case "weekly":
      next.setDate(next.getDate() + 7 * amount);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + amount);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3 * amount);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + amount);
      break;
    default:
      return null;
  }

  return next;
}
