"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, Gem, ReceiptText } from "lucide-react";
import Loader from "@/components/Loader";
import ModalPortal from "@/components/ModalPortal";
import PurchaseSubscriptionModal from "@/components/subscription/PurchaseSubscriptionModal";
import { useCachedParallel } from "@/hooks/useCachedParallel";
import { CACHE_KEYS } from "@/lib/cache-keys";
import { refreshAppCache } from "@/lib/refresh-app-cache";
import { DEFAULT_FX } from "@/lib/currency";
import {
  getSubscriptionCharge,
  getSubscriptionPriceBundle,
  normalizeSubscriptionCurrency,
  SUBSCRIPTION_CURRENCIES,
} from "@/lib/subscription-pricing";
import { applyAppearancePreference } from "@/lib/theme-client";
import { trackPremiumFunnel } from "@/lib/track-premium-funnel-client";
import { useUserStore } from "@/stores/useUserStore";

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function MySubscriptionPage() {
  const searchParams = useSearchParams();
  const fetchUser = useUserStore((s) => s.fetchUser);
  const { data: cached, loading, refresh } = useCachedParallel(
    [
      { key: CACHE_KEYS.subscriptionStatus, url: "/api/subscription/status" },
      { key: CACHE_KEYS.subscriptionHistory, url: "/api/subscription/history" },
    ],
    { deps: [] }
  );
  const status = cached[CACHE_KEYS.subscriptionStatus] || null;
  const paymentHistory = useMemo(
    () => (Array.isArray(cached[CACHE_KEYS.subscriptionHistory]?.history) ? cached[CACHE_KEYS.subscriptionHistory].history : []),
    [cached]
  );
  const paymentLoading = loading;
  const [voucherCode, setVoucherCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successPayload, setSuccessPayload] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("pro_monthly");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [paymentCurrency, setPaymentCurrency] = useState("USD");
  const [exchangeRates, setExchangeRates] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(false);

  function openPurchaseModal(source = "subscription_page") {
    setError("");
    setSelectedPlan("pro_monthly");
    setBillingCycle("monthly");
    setShowPurchaseModal(true);
    trackPremiumFunnel("purchase_modal_open", { source });
  }

  useEffect(() => {
    if (loading) return;
    trackPremiumFunnel("subscription_page_view", { source: "my_subscription" });
  }, [loading]);

  useEffect(() => {
    if (searchParams.get("purchase") !== "1" || loading) return;
    if (status?.isPremium) return;
    trackPremiumFunnel("upgrade_click", { source: "purchase_query", meta: { purchase: "1" } });
    openPurchaseModal("purchase_query");
  }, [searchParams, loading, status?.isPremium]);

  const effectiveRates = exchangeRates || DEFAULT_FX;

  const priceBundle = useMemo(
    () => getSubscriptionPriceBundle(paymentCurrency, effectiveRates),
    [paymentCurrency, effectiveRates]
  );

  const payableAmount = useMemo(
    () =>
      getSubscriptionCharge(selectedPlan, paymentCurrency, effectiveRates, {
        voucherApplied: Boolean(voucherCode.trim()) && selectedPlan === "pro_monthly",
      }),
    [selectedPlan, paymentCurrency, effectiveRates, voucherCode]
  );

  useEffect(() => {
    if (!showPurchaseModal) return undefined;
    let cancelled = false;
    (async () => {
      setRatesLoading(true);
      try {
        const res = await fetch("/api/exchange-rates", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && json?.rates) setExchangeRates(json.rates);
      } catch {
        if (!cancelled) setExchangeRates(null);
      } finally {
        if (!cancelled) setRatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showPurchaseModal]);

  const projectedEndDate = useMemo(() => {
    const durationDays = selectedPlan === "pro_yearly" ? 365 : 30;
    let baseDate = new Date();
    if (status?.isPremium && status?.subscriptionEndDate && new Date(status.subscriptionEndDate) > baseDate) {
      baseDate = new Date(status.subscriptionEndDate);
    }
    const end = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    return end.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }, [selectedPlan, status]);

  function invalidateAfterMutation() {
    refreshAppCache(["subscription", "user", "dashboard"]);
    refresh();
    void fetchUser({ force: true });
  }

  async function handlePayNow() {
    if (selectedPlan !== "pro_monthly" && selectedPlan !== "pro_yearly") return;

    trackPremiumFunnel("purchase_checkout_start", {
      source: "purchase_modal",
      meta: { plan: selectedPlan, currency: paymentCurrency },
    });

    setSaving(true);
    setError("");

    if (selectedPlan === "pro_yearly" && voucherCode.trim()) {
      setSaving(false);
      setError("Voucher code is only valid for monthly plan.");
      return;
    }

    const res = await fetch("/api/subscription/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: selectedPlan,
        voucherCode: voucherCode.trim(),
        currency: normalizeSubscriptionCurrency(paymentCurrency),
      }),
    });

    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(data.message || data.error || "Unable to activate subscription");
      return;
    }

    setShowPurchaseModal(false);
    setSuccessPayload(data);
    setShowSuccessModal(true);
    setVoucherCode("");
    setSelectedPlan("pro_monthly");
    invalidateAfterMutation();
  }

  async function cancelSubscription() {
    setPaymentMessage("Cancelling subscription...");
    const res = await fetch("/api/subscription/cancel", { method: "POST" });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setPaymentMessage(data.message || "Subscription cancelled.");
      applyAppearancePreference({ fontPreset: "manrope", fontSizePreset: "size-4", isPremium: false });
      invalidateAfterMutation();
      return;
    }

    setPaymentMessage(data.message || "Failed to cancel subscription.");
  }

  if (loading) {
    return <Loader label="Loading subscription..." className="min-h-[50vh]" />;
  }

  const isPremium = Boolean(status?.isPremium);
  const inGracePeriod = Boolean(status?.inGracePeriod);
  const endDate = status?.subscriptionEndDate;
  const graceEndDate = status?.graceEndDate;
  const canPurchaseSubscription = !isPremium || inGracePeriod;
  const showProBillingDetails = isPremium || inGracePeriod || Boolean(endDate) || Boolean(graceEndDate);
  const sectionCard =
    "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-slate-900/90 sm:p-5";
  const miniCard =
    "rounded-xl border border-zinc-200 bg-zinc-50/90 p-4 dark:border-zinc-700 dark:bg-slate-800/60";
  const statLabel = "text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400";
  const statValue = "mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-50";

  return (
    <div className="subscription-ui mx-auto w-full max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">My Subscription</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {isPremium
            ? "Manage your plan, apply voucher codes, and keep Pro benefits active."
            : "You're on the free plan. Upgrade anytime for unlimited records, premium exports, and more."}
        </p>
      </header>

      <section className={sectionCard}>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
              isPremium
                ? "border-amber-400/80 bg-amber-500 text-white shadow-sm"
                : "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-slate-800 dark:text-zinc-200"
            }`}
          >
            <Gem className="h-3.5 w-3.5" />
            {status?.subscriptionLabel || "Free Plan"}
          </span>
          {inGracePeriod ? (
            <span className="inline-flex rounded-full border border-emerald-500/50 bg-emerald-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
              Grace period active
            </span>
          ) : null}
        </div>

        {showProBillingDetails ? (
          <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-2">
            <div className={miniCard}>
              <p className={statLabel}>Pro ends</p>
              <p className={statValue}>{endDate ? formatDateTime(endDate) : "No active subscription"}</p>
            </div>
            <div className={miniCard}>
              <p className={statLabel}>Grace period ends</p>
              <p className={statValue}>{graceEndDate ? formatDateTime(graceEndDate) : "—"}</p>
            </div>
          </div>
        ) : (
          <div className={`${miniCard} mt-4`}>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">What&apos;s included on Free</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <li>50 active people and 50 active transactions</li>
              <li>Core dashboard, reminders, and community access</li>
              <li>CSV and JPG exports</li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Upgrade to Pro for unlimited records, premium PDF/Excel exports, smart reminders, recurring dues, and the
              premium UI theme.
            </p>
          </div>
        )}

        {isPremium || inGracePeriod ? (
          <div className="subscription-warning mt-4 rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/35 dark:text-amber-50">
            <p className="font-semibold">Pay before your due date to keep Pro benefits.</p>
            <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
              After your billing period ends, premium stays active for 7 extra days. If payment is not completed before
              the grace end date, Pro benefits are removed.
            </p>
          </div>
        ) : null}

        {canPurchaseSubscription ? (
          <div className="mt-5">
            <button
              type="button"
              onClick={openPurchaseModal}
              className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-400"
            >
              {isPremium ? "Renew or extend Pro" : "Upgrade to Pro"}
            </button>
          </div>
        ) : null}
      </section>

      <section className={`${sectionCard} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Payments</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {isPremium
                ? "Subscription events like purchase, renewal, voucher application, and cancellation."
                : "Billing history appears here after you upgrade or apply a voucher."}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
              isPremium
                ? "border-indigo-400/60 bg-indigo-600 text-white"
                : "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-slate-800 dark:text-zinc-200"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            {status?.subscriptionLabel || "Free Plan"}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className={miniCard}>
            <p className={statLabel}>Current plan</p>
            <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {status?.subscriptionLabel || "Free Plan"}
            </p>
          </div>
          <div className={miniCard}>
            <p className={statLabel}>Renewal / end date</p>
            <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {endDate ? new Date(endDate).toLocaleDateString() : isPremium ? "—" : "Not subscribed"}
            </p>
          </div>
          <div className={miniCard}>
            <p className={statLabel}>Billing source</p>
            <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {isPremium ? "Voucher / manual setup" : "Free tier"}
            </p>
          </div>
        </div>

        {isPremium ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="rounded-xl border border-rose-300 bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2 text-sm font-medium text-white shadow-[0_4px_12px_rgba(244,63,94,0.35)] transition hover:from-rose-600 hover:to-pink-600"
            >
              Cancel Subscription
            </button>
          </div>
        ) : null}

        {showCancelConfirm ? (
          <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowCancelConfirm(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-subscription-title"
              className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="cancel-subscription-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Cancel subscription?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                You will lose Pro benefits after your grace period ends. This cannot be undone.
              </p>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-slate-800 dark:text-zinc-100 dark:hover:bg-slate-700 sm:w-auto"
                >
                  Keep subscription
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowCancelConfirm(false);
                    await cancelSubscription();
                  }}
                  className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60 sm:w-auto"
                >
                  Yes, cancel
                </button>
              </div>
            </div>
          </div>
          </ModalPortal>
        ) : null}

        {paymentMessage ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{paymentMessage}</p> : null}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-zinc-500" />
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Payment & subscription history</p>
          </div>

          {paymentLoading ? (
            <Loader />
          ) : paymentHistory.length ? (
            paymentHistory.map((item) => (
              <article
                key={item._id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-slate-800/50"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {item.description || "No additional detail."}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{String(item.eventType || "event").replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs text-zinc-500">{new Date(item.occurredAt || item.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-600">
                  <span className="rounded-full border border-zinc-300 bg-white px-2.5 py-1">Status: {item.status}</span>
                  <span className="rounded-full border border-zinc-300 bg-white px-2.5 py-1">Cycle: {item.billingCycle}</span>
                  <span className="rounded-full border border-zinc-300 bg-white px-2.5 py-1">Amount: {(Number(item.amount || 0)).toFixed(2)} {item.currency || "USD"}</span>
                  {item.meta?.voucherCode ? <span className="rounded-full border border-zinc-300 bg-white px-2.5 py-1">Voucher: {item.meta.voucherCode}</span> : null}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-600 dark:bg-slate-800/40 dark:text-zinc-400">
              {isPremium
                ? "No subscription payment events yet. Purchases, renewals, vouchers, and cancellations will appear here."
                : "No billing history yet. Upgrade to Pro or apply a voucher to see payment events here."}
            </div>
          )}
        </div>
      </section>

      <PurchaseSubscriptionModal
        open={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        billingCycle={billingCycle}
        onBillingCycleChange={setBillingCycle}
        selectedPlan={selectedPlan}
        onSelectPlan={(plan) => {
          setSelectedPlan(plan);
          if (plan === "pro_yearly") setVoucherCode("");
        }}
        voucherCode={voucherCode}
        onVoucherChange={setVoucherCode}
        paymentCurrency={paymentCurrency}
        onPaymentCurrencyChange={setPaymentCurrency}
        supportedCurrencies={SUBSCRIPTION_CURRENCIES}
        priceBundle={priceBundle}
        ratesLoading={ratesLoading}
        payableAmount={payableAmount}
        projectedEndDate={projectedEndDate}
        error={error}
        saving={saving}
        onPayNow={handlePayNow}
      />

      {showSuccessModal && successPayload ? (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-xl rounded-2xl border border-emerald-200 bg-white p-5 shadow-2xl sm:p-6">
            <h2 className="text-xl font-semibold text-emerald-700">Your subscription is activated</h2>
            <p className="mt-2 text-sm text-zinc-700">
              Subscription is active until <span className="font-semibold">{formatDateTime(successPayload.subscriptionEndDate)}</span>.
            </p>
            <p className="mt-2 text-sm text-zinc-700">
              Activated at <span className="font-semibold">{formatDateTime(successPayload.activatedAt)}</span>.
            </p>
            <p className="mt-2 text-sm text-zinc-700">
              Grace period ends on <span className="font-semibold">{formatDateTime(successPayload.graceEndDate)}</span>.
            </p>
            <p className="subscription-warning mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              You need to pay before due dates, otherwise after 7 grace days you will lose Pro benefits.
            </p>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 sm:w-auto"
              >
                Done
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      ) : null}
    </div>
  );
}
