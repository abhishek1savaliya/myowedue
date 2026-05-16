"use client";

import { Crown, DollarSign, MousePointerClick, Percent, ShoppingCart, Sparkles } from "lucide-react";

function formatUsd(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function KpiCard({ label, value, sub, accent = "text-amber-300" }) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-4 shadow-lg shadow-black/20 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${accent}`}>
        {value == null ? "—" : value}
      </p>
      {sub ? <p className="mt-1.5 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function RevenueChart({ series }) {
  const max = Math.max(...(series || []).map((m) => m.revenueUsd || 0), 1);
  return (
    <div className="flex h-40 items-end gap-2 sm:gap-3">
      {(series || []).map((m) => {
        const v = m.revenueUsd || 0;
        const pct = Math.max((v / max) * 100, v > 0 ? 10 : 4);
        return (
          <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="text-[10px] font-semibold tabular-nums text-amber-200/90">{formatUsd(v)}</span>
            <div
              className="w-full max-w-[52px] rounded-t-md bg-linear-to-t from-amber-700 to-amber-400"
              style={{ height: `${pct}%`, minHeight: v > 0 ? "14px" : "4px" }}
            />
            <span className="text-center text-[10px] font-medium uppercase tracking-wider text-slate-500">{m.month}</span>
            <span className="text-[10px] tabular-nums text-slate-600">{m.conversions} conv.</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * @param {{ data: import("@/lib/premium-funnel").buildPremiumAdminInsights extends (...args: never) => infer R ? Awaited<R> : never; compact?: boolean }} props
 */
export default function PremiumInsightsPanel({ data, compact = false }) {
  const s = data?.summary;
  const f30 = data?.funnelLast30Days;

  if (!s) {
    return <p className="text-sm text-slate-500">No premium analytics available.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Premium clicks"
          value={s.upgradeClicks.toLocaleString()}
          sub={`${f30?.upgradeClicks ?? 0} in last 30 days`}
          accent="text-sky-300"
        />
        <KpiCard
          label="Purchase modal opens"
          value={s.modalOpens.toLocaleString()}
          sub={`${f30?.modalOpens ?? 0} in last 30 days`}
          accent="text-violet-300"
        />
        <KpiCard
          label="Conversions"
          value={s.conversions.toLocaleString()}
          sub={`${s.renewals} renewals · ${s.conversionRatePct}% from funnel`}
          accent="text-emerald-300"
        />
        <KpiCard
          label="Revenue (USD)"
          value={formatUsd(s.totalRevenueUsd)}
          sub={`${s.paidTransactionCount} paid transactions`}
          accent="text-amber-300"
        />
      </div>

      {!compact ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard
              label="Checkout starts"
              value={s.checkoutStarts.toLocaleString()}
              sub={`${s.checkoutToPurchasePct}% checkout → purchase`}
              accent="text-cyan-300"
            />
            <KpiCard
              label="Active Pro users"
              value={s.activeSubscribers.toLocaleString()}
              sub="Premium in good standing"
              accent="text-amber-300"
            />
            <KpiCard
              label="Subscription page views"
              value={s.subscriptionPageViews.toLocaleString()}
              sub={`${f30?.subscriptionPageViews ?? 0} in last 30 days`}
              accent="text-rose-300"
            />
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-slate-900/50 p-6 backdrop-blur-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <DollarSign className="h-4 w-4 text-amber-400" />
                Revenue & conversions (6 months)
              </h3>
            </div>
            <RevenueChart series={data.monthlyRevenue} />
          </div>

          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/50 p-6 backdrop-blur-sm">
            <h3 className="mb-4 text-sm font-semibold text-white">Funnel (last 30 days)</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { label: "Upgrade clicks", value: f30?.upgradeClicks, icon: MousePointerClick },
                { label: "Page views", value: f30?.subscriptionPageViews, icon: Sparkles },
                { label: "Modal opens", value: f30?.modalOpens, icon: Crown },
                { label: "Checkouts", value: f30?.checkoutStarts, icon: ShoppingCart },
                { label: "Completed", value: f30?.completions, icon: Percent },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3"
                >
                  <Icon className="mb-2 h-4 w-4 text-slate-500" />
                  <p className="text-2xl font-bold tabular-nums text-white">{value ?? 0}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/50 p-6 backdrop-blur-sm">
            <h3 className="mb-4 text-sm font-semibold text-white">Recent paid activity</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="pb-3 pr-4 font-semibold">User</th>
                    <th className="pb-3 pr-4 font-semibold">Event</th>
                    <th className="pb-3 pr-4 font-semibold">Plan</th>
                    <th className="pb-3 pr-4 font-semibold">Amount</th>
                    <th className="pb-3 font-semibold">When</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.recentConversions || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-slate-500">
                        No subscription payments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    data.recentConversions.map((row) => (
                      <tr key={row.id} className="border-b border-slate-800/80">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-slate-200">{row.userName}</p>
                          <p className="text-xs text-slate-500">{row.userEmail}</p>
                        </td>
                        <td className="py-3 pr-4 capitalize text-slate-300">{row.eventType}</td>
                        <td className="py-3 pr-4 text-slate-400">{row.plan || row.billingCycle || "—"}</td>
                        <td className="py-3 pr-4 tabular-nums text-amber-200">
                          {row.revenueUsd > 0
                            ? formatUsd(row.revenueUsd)
                            : `${row.amount} ${row.currency}`}
                        </td>
                        <td className="py-3 text-slate-500">
                          {row.occurredAt ? new Date(row.occurredAt).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
