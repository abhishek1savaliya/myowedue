export const FREE_RECORD_LIMIT = 500;
export const FREE_TRANSACTION_LIMIT = 700;
export const FREE_STORAGE_BYTES = 1 * 1024 * 1024 * 1024;
export const PREMIUM_STORAGE_BYTES = 10 * 1024 * 1024 * 1024;
export const PREMIUM_GRACE_DAYS = 7;
export const PREMIUM_MONTHLY_DURATION_DAYS = 30;

export const PLAN_DEFINITIONS = {
  free: {
    key: "free",
    label: "Free Plan",
    priceLabel: "$0",
    cadence: "forever",
    highlight: "Basic tracking for getting started",
    features: [
      "Basic tracking",
      "Manual reminders",
      `Limited records (${FREE_RECORD_LIMIT} active people and ${FREE_TRANSACTION_LIMIT} active transactions)`,
      "Basic dashboard",
    ],
  },
  pro_monthly: {
    key: "pro_monthly",
    label: "Pro Monthly",
    priceLabel: "$7",
    cadence: "month",
    highlight: "Premium automation, exports, and support",
    features: [
      "Unlimited records",
      "Smart reminders (SMS/WhatsApp ready)",
      "Advanced reports",
      "Recurring dues",
      "Export to PDF and Excel",
      "Payment links workspace",
      "Backup and recovery",
      "Unlimited bin retention",
      "Personalized priority support",
      "Premium UI, dark mode, and typography controls",
    ],
  },
  pro_yearly: {
    key: "pro_yearly",
    label: "Pro Yearly",
    priceLabel: "$70",
    cadence: "year",
    highlight: "Best value for long-term use",
    features: [
      "Everything in Pro Monthly",
      "Annual billing discount",
      "Priority premium support lane",
    ],
  },
};

export function hasActivePremium(user) {
  if (!user) return false;
  const isPremium = Boolean(user.isPremium);
  if (!isPremium) return false;
  if (!user.subscriptionEndDate) return false;
  const now = new Date();
  const endDate = new Date(user.subscriptionEndDate);
  if (Number.isNaN(endDate.getTime())) return false;
  const graceEndDate = new Date(endDate.getTime() + PREMIUM_GRACE_DAYS * 24 * 60 * 60 * 1000);
  return now <= graceEndDate;
}

export function getPremiumGraceEndDate(user) {
  if (!user?.subscriptionEndDate) return null;
  const endDate = new Date(user.subscriptionEndDate);
  if (Number.isNaN(endDate.getTime())) return null;
  return new Date(endDate.getTime() + PREMIUM_GRACE_DAYS * 24 * 60 * 60 * 1000);
}

export function isInPremiumGrace(user) {
  if (!hasActivePremium(user)) return false;
  if (!user?.subscriptionEndDate) return false;
  const now = new Date();
  const endDate = new Date(user.subscriptionEndDate);
  return now > endDate;
}

export function getEffectivePlan(user) {
  if (!hasActivePremium(user)) return PLAN_DEFINITIONS.free;
  const requestedPlan = PLAN_DEFINITIONS[user?.subscriptionPlan];
  if (!requestedPlan || requestedPlan.key === "free") {
    return PLAN_DEFINITIONS.pro_monthly;
  }
  return requestedPlan;
}

export function getRecordLimit(user) {
  return hasActivePremium(user) ? Number.POSITIVE_INFINITY : FREE_RECORD_LIMIT;
}

export function getTransactionLimit(user) {
  return hasActivePremium(user) ? Number.POSITIVE_INFINITY : FREE_TRANSACTION_LIMIT;
}

export function getBinRetentionLabel(user) {
  return hasActivePremium(user) ? "Unlimited" : "3 years";
}

export function supportsAdvancedReports(user) {
  return hasActivePremium(user);
}

export function supportsPremiumExports(user) {
  return hasActivePremium(user);
}

export function supportsPremiumSupport(user) {
  return hasActivePremium(user);
}

export function getStorageQuotaBytes(user) {
  return hasActivePremium(user) ? PREMIUM_STORAGE_BYTES : FREE_STORAGE_BYTES;
}
