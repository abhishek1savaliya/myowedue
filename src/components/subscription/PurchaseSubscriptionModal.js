"use client";

import {
  BadgeCheck,
  BarChart3,
  Bell,
  Check,
  Circle,
  Coins,
  FileSpreadsheet,
  Infinity,
  LineChart,
  Lock,
  Loader2,
  Palette,
  ShieldCheck,
  Sparkles,
  Ticket,
  X,
  Zap,
} from "lucide-react";
import ModalPortal from "@/components/ModalPortal";
import { PLAN_DEFINITIONS } from "@/lib/subscription";
import { formatSubscriptionPrice } from "@/lib/subscription-pricing";
import { cn } from "@/lib/utils";

const TIER_META = {
  free: {
    id: "free",
    planKey: null,
    title: "Free",
    subtitle: "Get started with core tracking",
    icon: Sparkles,
    featureIcons: [Zap, Bell, BarChart3],
  },
  pro_monthly: {
    id: "pro_monthly",
    planKey: "pro_monthly",
    title: "Pro",
    subtitle: "Everything in Free, and",
    icon: BadgeCheck,
    featureIcons: [Infinity, LineChart, Lock, FileSpreadsheet, Bell, Palette],
  },
  pro_yearly: {
    id: "pro_yearly",
    planKey: "pro_yearly",
    title: "Pro Yearly",
    subtitle: "Everything in Pro, and",
    icon: ShieldCheck,
    featureIcons: [Check, Sparkles, Zap],
    badge: "Save %",
  },
};

function TierFeature({ icon: Icon, text }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-zinc-400">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
      <span>{text}</span>
    </li>
  );
}

/**
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   billingCycle: "monthly" | "annual";
 *   onBillingCycleChange: (cycle: "monthly" | "annual") => void;
 *   selectedPlan: string;
 *   onSelectPlan: (plan: string) => void;
 *   voucherCode: string;
 *   onVoucherChange: (code: string) => void;
 *   paymentCurrency: string;
 *   onPaymentCurrencyChange: (code: string) => void;
 *   supportedCurrencies: string[];
 *   priceBundle: { currency: string; monthly: number; yearly: number; yearlyStrike: number; yearlyMonthlyEq: number; savingsPct: number };
 *   ratesLoading?: boolean;
 *   payableAmount: number;
 *   projectedEndDate: string;
 *   error: string;
 *   saving: boolean;
 *   onPayNow: () => void;
 * }} props
 */
export default function PurchaseSubscriptionModal({
  open,
  onClose,
  billingCycle,
  onBillingCycleChange,
  selectedPlan,
  onSelectPlan,
  voucherCode,
  onVoucherChange,
  paymentCurrency,
  onPaymentCurrencyChange,
  supportedCurrencies,
  priceBundle,
  ratesLoading = false,
  payableAmount,
  projectedEndDate,
  error,
  saving,
  onPayNow,
}) {
  if (!open) return null;

  const freeDef = PLAN_DEFINITIONS.free;
  const monthlyDef = PLAN_DEFINITIONS.pro_monthly;
  const yearlyDef = PLAN_DEFINITIONS.pro_yearly;
  const currency = priceBundle?.currency || paymentCurrency || "USD";

  const tiers = [
    {
      ...TIER_META.free,
      features: freeDef.features.slice(0, 5),
      priceLabel: formatSubscriptionPrice(0, currency),
      cadence: "/ forever",
    },
    {
      ...TIER_META.pro_monthly,
      features: monthlyDef.features.slice(0, 8),
      priceLabel: formatSubscriptionPrice(priceBundle?.monthly ?? 0, currency),
      cadence: "/ month",
      strikePrice: null,
    },
    {
      ...TIER_META.pro_yearly,
      features: yearlyDef.features,
      badge: `Save ${priceBundle?.savingsPct ?? 17}%`,
      priceLabel: formatSubscriptionPrice(priceBundle?.yearly ?? 0, currency),
      cadence: "/ year",
      strikePrice:
        billingCycle === "annual"
          ? formatSubscriptionPrice(priceBundle?.yearlyStrike ?? 0, currency)
          : null,
      footnote:
        billingCycle === "annual"
          ? `Equivalent to ${formatSubscriptionPrice(priceBundle?.yearlyMonthlyEq ?? 0, currency)}/mo · billed annually`
          : "Switch to Annual for best value",
    },
  ];

  const canPay = selectedPlan === "pro_monthly" || selectedPlan === "pro_yearly";
  const selectedLabel =
    selectedPlan === "pro_yearly" ? "Pro Yearly" : selectedPlan === "pro_monthly" ? "Pro" : "Free";

  function selectTier(tier) {
    if (!tier.planKey) {
      onSelectPlan("free");
      return;
    }
    onSelectPlan(tier.planKey);
    if (tier.planKey === "pro_yearly") onBillingCycleChange("annual");
    if (tier.planKey === "pro_monthly") onBillingCycleChange("monthly");
  }

  function handleBillingToggle(cycle) {
    onBillingCycleChange(cycle);
    if (cycle === "annual" && selectedPlan === "pro_monthly") {
      onSelectPlan("pro_yearly");
    }
    if (cycle === "monthly" && selectedPlan === "pro_yearly") {
      onSelectPlan("pro_monthly");
    }
  }

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex h-[100dvh] max-h-[100dvh] flex-col bg-zinc-950/90 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-subscription-title"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
          <div className="mx-auto max-w-5xl px-4 pb-8 pt-12 sm:px-6 sm:pb-10 sm:pt-14">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-500/30">
                <BadgeCheck className="h-8 w-8 text-amber-400" aria-hidden />
              </div>
              <h1
                id="purchase-subscription-title"
                className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl"
              >
                Upgrade to OWE DUE Pro
              </h1>
              <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-400">
                Choose the plan that fits your workflow. Pro adds private community likes, advanced dashboard insights,
                unlimited records, premium exports, and the full premium experience.
              </p>
            </div>

            <div className="mx-auto mt-8 flex w-full max-w-3xl flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                className="inline-flex self-center rounded-full border border-white/10 bg-zinc-900/80 p-1 sm:self-auto"
                role="tablist"
                aria-label="Billing cycle"
              >
                {[
                  { id: "annual", label: "Annual" },
                  { id: "monthly", label: "Monthly" },
                ].map(({ id, label }) => {
                  const active = billingCycle === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => handleBillingToggle(id)}
                      className={cn(
                        "rounded-full px-5 py-2 text-sm font-semibold transition",
                        active ? "bg-zinc-100 text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <label className="flex min-w-0 items-center gap-2 self-center sm:self-auto">
                <span className="sr-only">Payment currency</span>
                <Coins className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                <span className="hidden text-xs font-medium uppercase tracking-wide text-zinc-500 sm:inline">Pay in</span>
                <div className="relative min-w-[7.5rem] flex-1 sm:min-w-[8.5rem] sm:flex-none">
                  <select
                    value={paymentCurrency}
                    onChange={(e) => onPaymentCurrencyChange(e.target.value)}
                    disabled={ratesLoading}
                    className="w-full appearance-none rounded-full border border-white/10 bg-zinc-900/80 py-2 pl-4 pr-9 text-sm font-semibold text-zinc-100 outline-none transition focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 disabled:cursor-wait disabled:opacity-60"
                    aria-label="Payment currency"
                  >
                    {supportedCurrencies.map((code) => (
                      <option key={code} value={code} className="bg-zinc-900 text-zinc-100">
                        {code}
                      </option>
                    ))}
                  </select>
                  {ratesLoading ? (
                    <Loader2
                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-500"
                      aria-hidden
                    />
                  ) : (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">
                      ▾
                    </span>
                  )}
                </div>
              </label>
            </div>

            <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-zinc-500">
              Prices shown in {currency}. Base plan is billed in USD equivalent at live exchange rates.
            </p>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {tiers.map((tier) => {
                const isSelected =
                  tier.planKey === selectedPlan || (!tier.planKey && selectedPlan === "free");
                const TierIcon = tier.icon;
                const isYearly = tier.planKey === "pro_yearly";
                const isMonthly = tier.planKey === "pro_monthly";
                const dimmed =
                  (billingCycle === "monthly" && isYearly && !isSelected) ||
                  (billingCycle === "annual" && isMonthly && !isSelected);

                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => selectTier(tier)}
                    className={cn(
                      "relative flex w-full flex-col rounded-2xl border p-5 text-left transition",
                      "bg-zinc-900/60 hover:bg-zinc-900/80",
                      isSelected
                        ? "border-amber-500/70 ring-1 ring-amber-500/40"
                        : "border-white/10 hover:border-white/20",
                      dimmed && !isSelected && "opacity-75"
                    )}
                  >
                    <div className="absolute right-4 top-4">
                      {isSelected ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-zinc-950">
                          <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                        </span>
                      ) : (
                        <Circle className="h-6 w-6 text-zinc-600" strokeWidth={1.5} aria-hidden />
                      )}
                    </div>

                    <div className="flex items-center gap-2 pr-8">
                      <TierIcon
                        className={cn("h-5 w-5 shrink-0", tier.planKey ? "text-amber-400" : "text-zinc-400")}
                        aria-hidden
                      />
                      <span className="text-lg font-bold text-zinc-50">{tier.title}</span>
                      {tier.badge ? (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                          {tier.badge}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-baseline gap-1">
                      {tier.strikePrice ? (
                        <span className="text-sm text-zinc-500 line-through">{tier.strikePrice}</span>
                      ) : null}
                      <span className="text-2xl font-bold text-zinc-50">{tier.priceLabel}</span>
                      <span className="text-sm text-zinc-500">{tier.cadence}</span>
                    </div>

                    {tier.footnote ? <p className="mt-1 text-xs text-zinc-500">{tier.footnote}</p> : null}

                    <p className="mt-4 text-xs font-medium uppercase tracking-wide text-zinc-500">{tier.subtitle}</p>
                    <ul className="mt-3 space-y-2.5">
                      {tier.features.map((text, idx) => (
                        <TierFeature
                          key={text}
                          icon={tier.featureIcons[idx % tier.featureIcons.length] || Check}
                          text={text}
                        />
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            {selectedPlan === "pro_monthly" ? (
              <div className="mx-auto mt-6 max-w-md">
                <label className="block text-sm font-medium text-zinc-300">
                  <span className="mb-2 inline-flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-amber-400" aria-hidden />
                    Voucher code
                    <span className="font-normal text-zinc-500">(monthly only)</span>
                  </span>
                  <input
                    value={voucherCode}
                    onChange={(e) => onVoucherChange(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
                  />
                </label>
              </div>
            ) : null}

            {error ? <p className="mt-4 text-center text-sm text-rose-400">{error}</p> : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-zinc-950/95 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-50">{selectedLabel}</p>
              {canPay ? (
                <>
                  <p className="mt-0.5 text-lg font-bold text-zinc-50">
                    {payableAmount === 0 ? (
                      "Free with voucher"
                    ) : (
                      <>
                        {formatSubscriptionPrice(payableAmount, currency)}
                        <span className="text-sm font-normal text-zinc-500">
                          {selectedPlan === "pro_yearly" ? " / year" : " / month"}
                        </span>
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Active until <span className="text-zinc-400">{projectedEndDate}</span>
                  </p>
                </>
              ) : (
                <p className="mt-0.5 text-sm text-zinc-500">Stay on the free plan or pick Pro to upgrade.</p>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              {canPay ? (
                <button
                  type="button"
                  onClick={onPayNow}
                  disabled={saving}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-zinc-100 px-8 text-sm font-bold text-zinc-900 transition hover:bg-white disabled:opacity-60 sm:w-auto"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {saving ? "Processing…" : `Subscribe & pay · ${currency}`}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/15 px-8 text-sm font-semibold text-zinc-200 transition hover:bg-white/5 sm:w-auto"
                >
                  Continue with Free
                </button>
              )}
            </div>
          </div>
          <p className="mx-auto mt-3 max-w-5xl text-center text-[10px] leading-relaxed text-zinc-600">
            By subscribing you agree to our terms. Plans renew automatically unless cancelled before the renewal date.
          </p>
        </div>
      </div>
    </ModalPortal>
  );
}
