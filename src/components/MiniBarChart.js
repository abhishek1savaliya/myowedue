"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, TrendingUp, Users } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { uiCard } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

function useAnimatedNumber(target, duration = 800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const end = Number(target || 0);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setValue(end);
      return undefined;
    }

    let frameId;
    const start = value;
    const delta = end - start;
    const startedAt = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(start + delta * eased);
      if (progress < 1) frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [target, duration]);

  return value;
}

function formatAxisLabel(raw, variant) {
  const text = String(raw ?? "");
  if (variant !== "monthly") return text;
  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match) return text;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function InsightLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-linear-to-r from-amber-500 to-orange-400 shadow-[0_0_8px_rgba(245,158,11,0.45)]" />
        Given
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-linear-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
        Received
      </span>
    </div>
  );
}

function AnimatedCurrency({ amount, currency }) {
  const animated = useAnimatedNumber(amount);
  return <>{formatCurrency(animated, currency)}</>;
}

function InsightRow({ row, currency, maxTotal, animate }) {
  const { label, given, received, total } = row;
  const scale = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  const givenShare = total > 0 ? (given / total) * 100 : 0;
  const receivedShare = total > 0 ? (received / total) * 100 : 0;

  return (
    <li className="premium-insight-row group rounded-xl border border-transparent px-2 py-2.5 transition hover:border-zinc-200/80 hover:bg-zinc-50/80 dark:hover:border-white/10 dark:hover:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{label}</p>
        <p className="shrink-0 text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          <span className="font-semibold text-foreground">
            <AnimatedCurrency amount={total} currency={currency} />
          </span>
          <span className="ml-1 hidden sm:inline">total</span>
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11px] tabular-nums">
        {given > 0 ? (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
            <TrendingUp className="h-3 w-3 rotate-180 opacity-70" aria-hidden />
            <AnimatedCurrency amount={given} currency={currency} />
            <span className="text-zinc-400">given</span>
          </span>
        ) : null}
        {received > 0 ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
            <TrendingUp className="h-3 w-3 opacity-70" aria-hidden />
            <AnimatedCurrency amount={received} currency={currency} />
            <span className="text-zinc-400">received</span>
          </span>
        ) : null}
      </div>

      <div
        className="premium-insight-bar-track mt-2.5"
        role="img"
        aria-label={`${label}: ${formatCurrency(given, currency)} given, ${formatCurrency(received, currency)} received`}
      >
        <div
          className="premium-insight-bar-fill flex h-full overflow-hidden rounded-full transition-[width] duration-700 ease-out"
          style={{ width: animate ? `${scale}%` : "0%" }}
        >
          {given > 0 ? (
            <div
              className="premium-insight-bar-given h-full min-w-0 transition-[width] duration-700 ease-out"
              style={{ width: animate ? `${givenShare}%` : "0%" }}
            />
          ) : null}
          {received > 0 ? (
            <div
              className="premium-insight-bar-received h-full min-w-0 transition-[width] duration-700 ease-out"
              style={{ width: animate ? `${receivedShare}%` : "0%" }}
            />
          ) : null}
        </div>
      </div>
    </li>
  );
}

/**
 * Premium insight cards for dashboard monthly / person breakdowns.
 * @param {{ title: string; data?: object[]; xKey: string; aKey: string; bKey: string; currency?: string; variant?: "monthly" | "person" }} props
 */
export default function MiniBarChart({
  title,
  data = [],
  xKey,
  aKey,
  bKey,
  currency = "USD",
  variant = "monthly",
}) {
  const [animate, setAnimate] = useState(false);
  const Icon = variant === "person" ? Users : CalendarDays;
  const accentClass =
    variant === "person" ? "premium-insight-card--person" : "premium-insight-card--monthly";

  const rows = useMemo(() => {
    return data.slice(0, 8).map((item, idx) => {
      const given = Number(item[aKey] || 0);
      const received = Number(item[bKey] || 0);
      return {
        key: `${item[xKey]}-${idx}`,
        label: formatAxisLabel(item[xKey], variant),
        given,
        received,
        total: given + received,
      };
    });
  }, [data, aKey, bKey, xKey, variant]);

  const maxTotal = useMemo(() => Math.max(1, ...rows.map((r) => r.total)), [rows]);

  const totals = useMemo(
    () => rows.reduce((acc, row) => ({ given: acc.given + row.given, received: acc.received + row.received }), { given: 0, received: 0 }),
    [rows]
  );

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setAnimate(true);
      return undefined;
    }
    setAnimate(false);
    const frameId = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frameId);
  }, [data]);

  return (
    <section
      className={cn(
        "premium-insight-card",
        accentClass,
        uiCard,
        "relative overflow-hidden p-5 sm:p-6"
      )}
    >
      <div className="premium-insight-card-glow pointer-events-none" aria-hidden />

      <header className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="premium-insight-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{title}</h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {variant === "person" ? "Activity by contact" : "Activity by month"}
            </p>
          </div>
        </div>
        <InsightLegend />
      </header>

      {rows.length > 0 ? (
        <div className="relative mt-4 grid grid-cols-2 gap-2 rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-3 dark:border-white/8 dark:bg-white/[0.03] sm:gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Total given</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-300">
              <AnimatedCurrency amount={totals.given} currency={currency} />
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Total received</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              <AnimatedCurrency amount={totals.received} currency={currency} />
            </p>
          </div>
        </div>
      ) : null}

      <ul className="relative mt-4 space-y-1">
        {rows.length === 0 ? (
          <li className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200/90 px-4 py-10 text-center dark:border-white/10">
            <BarChart3 className="h-8 w-8 text-zinc-300 dark:text-zinc-600" aria-hidden />
            <p className="mt-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">No activity yet</p>
            <p className="mt-1 max-w-xs text-xs text-zinc-500">Insights appear once you record credits and debits.</p>
          </li>
        ) : (
          rows.map((row) => (
            <InsightRow key={row.key} row={row} currency={currency} maxTotal={maxTotal} animate={animate} />
          ))
        )}
      </ul>
    </section>
  );
}
