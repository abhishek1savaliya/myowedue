"use client";

import Link from "next/link";
import { Calendar, CalendarClock, FileDown, Lock, Sparkles } from "lucide-react";
import { uiCard } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export default function EventsInsightsUpsell() {
  return (
    <section
      className={cn(
        "premium-insight-card premium-insight-card--advanced relative overflow-hidden",
        uiCard,
        "p-5 sm:p-6"
      )}
    >
      <div className="premium-insight-card-glow pointer-events-none opacity-60" aria-hidden />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/50 text-zinc-400">
            <Lock className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">Events insights</h2>
            <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
              See upcoming vs past counts, this month&apos;s schedule, your next event, and export themed PDFs—Pro only.
            </p>
          </div>
        </div>

        <Link
          href="/my-subscription?purchase=1"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Upgrade to Pro
        </Link>
      </div>

      <div className="relative mt-5 grid gap-3 opacity-70 sm:grid-cols-3" aria-hidden>
        {[
          { icon: Calendar, label: "Schedule summary" },
          { icon: CalendarClock, label: "Next event" },
          { icon: FileDown, label: "Premium PDF export" },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="rounded-xl border border-dashed border-zinc-300/80 bg-zinc-50/50 p-4 dark:border-white/10 dark:bg-white/[0.02]"
          >
            <Icon className="h-5 w-5 text-zinc-400" />
            <p className="mt-2 text-xs font-medium text-zinc-500">{label}</p>
            <div className="mt-3 h-2 rounded-full bg-zinc-200/80 dark:bg-white/10" />
          </div>
        ))}
      </div>
    </section>
  );
}
