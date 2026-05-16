"use client";

import Link from "next/link";
import { Gem, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { uiCard } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

function MetricTile({ label, value, hint, tone = "default" }) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-500/25 bg-emerald-500/10"
      : tone === "amber"
        ? "border-amber-500/25 bg-amber-500/10"
        : tone === "rose"
          ? "border-rose-500/25 bg-rose-500/10"
          : "border-zinc-200/80 bg-zinc-50/80 dark:border-white/10 dark:bg-white/[0.03]";

  return (
    <div className={cn("rounded-xl border p-4", toneClass)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
    </div>
  );
}

function ContactRow({ name, amount, currency, variant }) {
  const amountClass =
    variant === "owe" ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300";
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="truncate font-medium text-foreground">{name}</span>
      <span className={cn("shrink-0 tabular-nums font-semibold", amountClass)}>
        {formatCurrency(amount, currency)}
      </span>
    </li>
  );
}

/**
 * @param {{ insights: ReturnType<import("@/lib/people-insights").buildPeopleInsights>; currency: string }} props
 */
export default function PeoplePremiumInsights({ insights, currency }) {
  if (!insights?.contactCount) return null;

  return (
    <section
      className={cn(
        "premium-insight-card premium-insight-card--person relative overflow-hidden",
        uiCard,
        "p-5 sm:p-6"
      )}
    >
      <div className="premium-insight-card-glow pointer-events-none" aria-hidden />

      <header className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="premium-insight-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
                People insights
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                <Gem className="h-3 w-3" aria-hidden />
                Pro
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Receivables, payables, and top contacts ({currency})
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
          label="To receive"
          value={formatCurrency(insights.receivable, currency)}
          hint={`${insights.activeWithDue} with open balance`}
          tone="emerald"
        />
        <MetricTile
          label="To pay"
          value={formatCurrency(insights.payable, currency)}
          hint="You owe contacts"
          tone="rose"
        />
        <MetricTile
          label="Net exposure"
          value={`${insights.netExposure >= 0 ? "+" : ""}${formatCurrency(insights.netExposure, currency)}`}
          hint={insights.netExposure >= 0 ? "More coming in" : "More going out"}
          tone="amber"
        />
        <MetricTile
          label="Collection rate"
          value={`${insights.collectionEfficiency}%`}
          hint={`${insights.settledCount} settled · ${insights.contactCount} contacts`}
        />
      </div>

      <div className="relative mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-white/8 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Top owed to you</p>
          </div>
          <ul className="mt-3 space-y-2">
            {insights.topOwedToYou.length ? (
              insights.topOwedToYou.map((row) => (
                <ContactRow key={row.id} name={row.name} amount={row.due} currency={currency} variant="receive" />
              ))
            ) : (
              <li className="text-sm text-zinc-500">No receivables right now.</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-white/8 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-rose-500" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Top you owe</p>
          </div>
          <ul className="mt-3 space-y-2">
            {insights.topYouOwe.length ? (
              insights.topYouOwe.map((row) => (
                <ContactRow key={row.id} name={row.name} amount={row.due} currency={currency} variant="owe" />
              ))
            ) : (
              <li className="text-sm text-zinc-500">Nothing payable right now.</li>
            )}
          </ul>
        </div>
      </div>

      <p className="relative mt-4 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Total given {formatCurrency(insights.totalGiven, currency)} · received back{" "}
        {formatCurrency(insights.totalReceived, currency)}
      </p>
    </section>
  );
}
