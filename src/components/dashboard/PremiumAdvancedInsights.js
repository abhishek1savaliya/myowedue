"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Activity, Gem, PieChart, Target, TrendingUp, Users } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { buildAdvancedDashboardInsights } from "@/lib/dashboard-insights";
import { uiCard } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

function MetricTile({ label, value, hint, tone = "default" }) {
  const toneClass =
    tone === "amber"
      ? "border-amber-500/25 bg-amber-500/10"
      : tone === "emerald"
        ? "border-emerald-500/25 bg-emerald-500/10"
        : tone === "sky"
          ? "border-sky-500/25 bg-sky-500/10"
          : "border-white/10 bg-white/[0.04]";

  return (
    <div className={cn("rounded-xl border p-4", toneClass)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
    </div>
  );
}

function formatMonthLabel(month) {
  const match = String(month || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/**
 * @param {{ data: object }} props
 */
export default function PremiumAdvancedInsights({ data }) {
  const insights = useMemo(() => buildAdvancedDashboardInsights(data), [data]);
  const { currency, topPeople } = insights;
  const maxPersonTotal = Math.max(1, ...topPeople.map((p) => p.total));

  return (
    <section
      className={cn(
        "premium-insight-card premium-insight-card--advanced relative overflow-hidden",
        uiCard,
        "p-5 sm:p-6"
      )}
    >
      <div className="premium-insight-card-glow pointer-events-none" aria-hidden />

      <header className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="premium-insight-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
            <Activity className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
                Advanced Insights
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                <Gem className="h-3 w-3" aria-hidden />
                Pro
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Collection health, exposure, and concentration across your pending ledger ({currency})
            </p>
          </div>
        </div>
        <Link
          href="/reports"
          className="shrink-0 text-xs font-semibold text-amber-600 underline-offset-2 hover:underline dark:text-amber-300"
        >
          Open reports →
        </Link>
      </header>

      <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Collection efficiency"
          value={`${insights.collectionEfficiency}%`}
          hint="Share of given funds already received back"
          tone="emerald"
        />
        <MetricTile
          label="Open exposure"
          value={formatCurrency(insights.openExposure, currency)}
          hint={`${insights.pendingCount} pending entries`}
          tone="amber"
        />
        <MetricTile
          label="Net position"
          value={`${insights.netPosition >= 0 ? "+" : ""}${formatCurrency(insights.netPosition, currency)}`}
          hint={insights.netPosition >= 0 ? "You owe on balance" : "Others owe you on balance"}
          tone="sky"
        />
        <MetricTile
          label="Top counterparty"
          value={insights.topPerson?.name || "—"}
          hint={
            insights.topPerson
              ? `${formatCurrency(insights.topPerson.total, currency)} volume · ${insights.concentrationPct}% of activity`
              : "Add transactions to see leaders"
          }
        />
      </div>

      <div className="relative mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-white/8 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-500" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Exposure by person</p>
          </div>
          <ul className="mt-3 space-y-3">
            {topPeople.length ? (
              topPeople.map((person) => (
                <li key={person.name}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-foreground">{person.name}</span>
                    <span className="shrink-0 tabular-nums text-zinc-500">
                      {formatCurrency(person.total, currency)}
                    </span>
                  </div>
                  <div className="premium-insight-bar-track mt-1.5">
                    <div
                      className="premium-insight-bar-fill flex h-full overflow-hidden rounded-full"
                      style={{ width: `${(person.total / maxPersonTotal) * 100}%` }}
                    >
                      <div
                        className="premium-insight-bar-given h-full"
                        style={{ width: person.total > 0 ? `${(person.given / person.total) * 100}%` : "0%" }}
                      />
                      <div
                        className="premium-insight-bar-received h-full"
                        style={{ width: person.total > 0 ? `${(person.received / person.total) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li className="text-sm text-zinc-500">No person-level data yet.</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-white/8 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-sky-500" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Quick signals</p>
          </div>
          <ul className="mt-3 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
              <span className="text-zinc-600 dark:text-zinc-300">
                Avg. exposure per contact:{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(insights.avgPendingPerPerson, currency)}
                </span>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              <span className="text-zinc-600 dark:text-zinc-300">
                Busiest month:{" "}
                <span className="font-semibold text-foreground">
                  {insights.topMonth ? formatMonthLabel(insights.topMonth.month) : "—"}
                </span>
                {insights.topMonth
                  ? ` · ${formatCurrency(insights.topMonth.total, currency)}`
                  : ""}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
              <span className="text-zinc-600 dark:text-zinc-300">
                Tracked contacts:{" "}
                <span className="font-semibold text-foreground">{insights.peopleCount}</span>
                {insights.pendingCount > 0
                  ? ` · ${insights.pendingCount} pending`
                  : " · all clear"}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
