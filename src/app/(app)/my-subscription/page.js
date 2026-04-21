"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, Gem, ReceiptText, ShieldCheck, Ticket, X } from "lucide-react";
import Loader from "@/components/Loader";
import { applyAppearancePreference } from "@/lib/theme-client";

const PRO_BENEFITS = [
  { feature: "Records", free: "500 people + 700 transactions", pro: "Unlimited people and transactions" },
  { feature: "Reminders", free: "Manual", pro: "Smart reminder workflows" },
  { feature: "Reports", free: "Basic snapshot", pro: "Advanced reports and insights" },
  { feature: "Exports", free: "CSV and JPG", pro: "Premium PDF and Excel" },
  { feature: "Recurring dues", free: "No", pro: "Yes" },
  { feature: "Premium UI", free: "Standard", pro: "Premium dark UI and typography controls" },
  { feature: "Support", free: "Standard", pro: "Priority support" },
];

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function MySubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successPayload, setSuccessPayload] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("pro_monthly");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const payableAmount = useMemo(() => {
    if (selectedPlan === "pro_yearly") return 70;
    return voucherCode.trim() ? 0 : 7;
  }, [selectedPlan, voucherCode]);

  const projectedEndDate = useMemo(() => {
    const durationDays = selectedPlan === "pro_yearly" ? 365 : 30;
    let baseDate = new Date();
    if (status?.isPremium && status?.subscriptionEndDate && new Date(status.subscriptionEndDate) > baseDate) {
      baseDate = new Date(status.subscriptionEndDate);
    }
    const end = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    return end.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }, [selectedPlan, status]);

  async function loadStatus() {
    setLoading(true);
    const res = await fetch("/api/subscription/status", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setStatus(data);
    setLoading(false);
  }

  async function loadPaymentHistory() {
    setPaymentLoading(true);
    const res = await fetch("/api/subscription/history", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setPaymentHistory(Array.isArray(data.history) ? data.history : []);
    }
    setPaymentLoading(false);
  }

  useEffect(() => {
    loadStatus();
    loadPaymentHistory();
  }, []);

  async function handlePayNow() {
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
    await loadStatus();
    await loadPaymentHistory();
  }

  async function cancelSubscription() {
    setPaymentMessage("Cancelling subscription...");
    const res = await fetch("/api/subscription/cancel", { method: "POST" });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setPaymentMessage(data.message || "Subscription cancelled.");
      applyAppearancePreference({ fontPreset: "manrope", fontSizePreset: "size-4", isPremium: false });
      await loadStatus();
      await loadPaymentHistory();
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

  return (
    <div className="subscription-ui mx-auto w-full max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">My Subscription</h1>
        <p className="text-sm text-zinc-600">Manage your plan, apply voucher codes, and keep Pro benefits active.</p>
      </header>

      <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 shadow-[0_4px_20px_rgba(245,158,11,0.10)] sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${isPremium ? "border-amber-400 bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-[0_2px_8px_rgba(245,158,11,0.35)]" : "border-zinc-300 bg-zinc-50 text-zinc-600"}`}>
            <Gem className="h-3.5 w-3.5" />
            {status?.subscriptionLabel || "Free Plan"}
          </span>
          {inGracePeriod ? (
            <span className="inline-flex rounded-full border border-emerald-400 bg-gradient-to-r from-emerald-400 to-teal-400 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-[0_2px_8px_rgba(16,185,129,0.35)]">
              Grace Period Active
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600">Pro ends</p>
            <p className="mt-2 text-base font-semibold text-sky-900">{endDate ? formatDateTime(endDate) : "No active subscription"}</p>
          </div>
          <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Grace period ends</p>
            <p className="mt-2 text-base font-semibold text-violet-900">{graceEndDate ? formatDateTime(graceEndDate) : "-"}</p>
          </div>
        </div>

        <div className="subscription-warning mt-4 rounded-xl border border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 p-4 text-sm text-orange-800">
          <p className="font-semibold">⚠ Pay before due date to avoid losing benefits.</p>
          <p className="mt-1">
            After subscription ends, premium stays active for 7 extra days. If payment is not completed before grace end date, premium benefits are removed.
          </p>
        </div>

        {canPurchaseSubscription ? (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => {
                setError("");
                setShowPurchaseModal(true);
              }}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(245,158,11,0.4)] transition hover:from-amber-600 hover:to-orange-600"
            >
              Purchase Subscription
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4 shadow-[0_4px_20px_rgba(99,102,241,0.08)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-indigo-900">Payments</h2>
            <p className="mt-1 text-sm text-indigo-700/70">See subscription-related events like purchase, renewal, voucher application, and cancellation.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-300 bg-gradient-to-r from-indigo-500 to-sky-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_2px_8px_rgba(99,102,241,0.35)]">
            <CreditCard className="h-3.5 w-3.5" />
            {status?.subscriptionLabel || "Free Plan"}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-600">Current Plan</p>
            <p className="mt-2 text-xl font-semibold text-amber-900">{status?.subscriptionLabel || "Free Plan"}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">Renewal / End Date</p>
            <p className="mt-2 text-xl font-semibold text-emerald-900">{endDate ? new Date(endDate).toLocaleDateString() : "No active cycle"}</p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-600">Billing Source</p>
            <p className="mt-2 text-xl font-semibold text-sky-900">{isPremium ? "Voucher / manual setup" : "Free tier"}</p>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50 p-6 shadow-2xl">
              <h2 className="text-lg font-semibold text-rose-700">Cancel Subscription?</h2>
              <p className="mt-2 text-sm leading-6 text-rose-600/80">
                You will lose all Pro benefits immediately after the grace period ends. This action cannot be undone.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    setShowCancelConfirm(false);
                    await cancelSubscription();
                  }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(244,63,94,0.35)] hover:from-rose-600 hover:to-pink-600"
                >
                  Yes, cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:from-emerald-100 hover:to-teal-100"
                >
                  Keep subscription
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {paymentMessage ? <p className="text-sm text-zinc-600">{paymentMessage}</p> : null}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-zinc-500" />
            <p className="text-sm font-medium text-black">Payment & Subscription History</p>
          </div>

          {paymentLoading ? (
            <Loader />
          ) : paymentHistory.length ? (
            paymentHistory.map((item) => (
              <article key={item._id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-black">{item.title}</p>
                    <p className="mt-1 text-sm text-zinc-600">{item.description || "No additional detail."}</p>
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
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
              No subscription payment events yet. Voucher activation, purchase, renewal, auto-payment deductions, and cancellations will appear here.
            </div>
          )}
        </div>
      </section>

      {showPurchaseModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-black">Pro Subscription Benefits</h2>
                <p className="mt-1 text-sm text-zinc-600">Choose Monthly ($7) or Yearly ($70). Voucher works only on Monthly.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPurchaseModal(false)}
                className="rounded-lg border border-zinc-300 p-1.5 text-zinc-500 hover:text-zinc-800"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full min-w-155 text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left">
                    <th className="px-3 py-2 font-semibold text-zinc-700">Benefit</th>
                    <th className="px-3 py-2 font-semibold text-zinc-700">Free</th>
                    <th className="px-3 py-2 font-semibold text-amber-700">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {PRO_BENEFITS.map((row) => (
                    <tr key={row.feature} className="border-b border-zinc-100">
                      <td className="px-3 py-2 font-medium text-zinc-800">{row.feature}</td>
                      <td className="px-3 py-2 text-zinc-600">{row.free}</td>
                      <td className="px-3 py-2 text-zinc-800">{row.pro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="text-sm text-zinc-700">
                <span className="mb-1 inline-flex items-center gap-2 font-medium">
                  <CreditCard className="h-4 w-4" /> Select Plan
                </span>
                <select
                  value={selectedPlan}
                  onChange={(e) => {
                    const plan = e.target.value;
                    setSelectedPlan(plan);
                    if (plan === "pro_yearly") {
                      setVoucherCode("");
                    }
                  }}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2"
                >
                  <option value="pro_monthly">Pro Monthly - $7</option>
                  <option value="pro_yearly">Pro Yearly - $70</option>
                </select>
              </label>
              <label className="text-sm text-zinc-700">
                <span className="mb-1 inline-flex items-center gap-2 font-medium">
                  <Ticket className="h-4 w-4" /> Voucher Code
                </span>
                <input
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  placeholder={selectedPlan === "pro_yearly" ? "Voucher not available for yearly plan" : "Enter voucher"}
                  disabled={selectedPlan === "pro_yearly"}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                />
              </label>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                <p>Amount to pay</p>
                <p className="mt-1 text-xl font-semibold text-black">${payableAmount}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  Subscription active until <span className="font-semibold text-zinc-700">{projectedEndDate}</span>
                </p>
              </div>
            </div>

            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={handlePayNow}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 sm:w-auto"
              >
                {saving ? <Loader className="py-0 text-white" /> : <ShieldCheck className="h-4 w-4" />}
                {saving ? "Processing..." : "Pay Now"}
              </button>
              <button
                type="button"
                onClick={() => setShowPurchaseModal(false)}
                className="w-full rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 sm:w-auto"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showSuccessModal && successPayload ? (
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
      ) : null}
    </div>
  );
}
