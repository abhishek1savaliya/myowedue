"use client";

import moment from "moment-timezone";
import { Calendar, CalendarClock, Gem, MapPin } from "lucide-react";
import { uiCard } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const DEFAULT_TIMEZONE = "Australia/Melbourne";

function MetricTile({ label, value, hint, tone = "default" }) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-500/25 bg-emerald-500/10"
      : tone === "amber"
        ? "border-amber-500/25 bg-amber-500/10"
        : tone === "sky"
          ? "border-sky-500/25 bg-sky-500/10"
          : "border-zinc-200/80 bg-zinc-50/80 dark:border-white/10 dark:bg-white/[0.03]";

  return (
    <div className={cn("rounded-xl border p-4", toneClass)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
    </div>
  );
}

function formatNextEvent(nextEvent) {
  if (!nextEvent?.startTime) return "None scheduled";
  const tz = nextEvent.timezone || DEFAULT_TIMEZONE;
  const m = moment(nextEvent.startTime).tz(tz);
  if (nextEvent.allDay) return m.format("ddd, MMM D");
  return m.format("ddd, MMM D · h:mm A");
}

/**
 * @param {{ insights: import("@/lib/events-insights").buildEventsInsights extends (...args: never) => infer R ? R : never }} props
 */
export default function EventsPremiumInsights({ insights }) {
  if (!insights?.totalCount) return null;

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
            <Calendar className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">Events insights</h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                <Gem className="h-3 w-3" aria-hidden />
                Pro
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Upcoming schedule and calendar summary</p>
          </div>
        </div>
        <p className="shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">PDF export below</p>
      </header>

      <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Upcoming"
          value={String(insights.upcomingCount)}
          hint={`${insights.pastCount} past`}
          tone="emerald"
        />
        <MetricTile
          label="This month"
          value={String(insights.thisMonthCount)}
          hint={`${insights.totalCount} total events`}
          tone="sky"
        />
        <MetricTile
          label="With location"
          value={String(insights.withLocationCount)}
          hint={`${insights.allDayCount} all-day`}
        />
        <MetricTile
          label="Next up"
          value={insights.nextEvent ? formatNextEvent(insights.nextEvent) : "—"}
          hint={insights.nextEvent?.title || "No upcoming events"}
          tone="amber"
        />
      </div>

      {insights.nextEvent ? (
        <div className="relative mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700/80 dark:text-amber-200/80">
                Next event
              </p>
              <p className="mt-1 font-semibold text-foreground">{insights.nextEvent.title}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{formatNextEvent(insights.nextEvent)}</p>
            </div>
          </div>
        </div>
      ) : null}

      <p className="relative mt-4 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Export selected or all events as a themed PDF with Pro
      </p>
    </section>
  );
}
