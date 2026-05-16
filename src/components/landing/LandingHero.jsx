import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CreditCard,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AnimatedCounter from "@/components/landing/AnimatedCounter";

const TRUST = ["SOC2-ready practices", "Encrypted at rest", "No card required", "Free forever tier"];

const CHART_HEIGHTS = [40, 65, 45, 80, 55, 90, 70, 95, 60, 85];

const FLOATING = [
  {
    className: "left-[4%] top-[12%] md:left-[2%]",
    icon: TrendingUp,
    label: "Net position",
    value: "+$4,280",
    sub: "vs last month",
    accent: "text-emerald-400",
  },
  {
    className: "right-[2%] top-[18%] md:right-[0%]",
    icon: Bell,
    label: "Due tomorrow",
    value: "3 reminders",
    sub: "auto-scheduled",
    accent: "text-amber-300",
  },
  {
    className: "bottom-[8%] left-[8%] md:left-[6%]",
    icon: Users,
    label: "Active contacts",
    value: "128 people",
    sub: "fully synced",
    accent: "text-sky-300",
  },
];

export default function LandingHero({ content, heroStats }) {
  const stats =
    heroStats.length > 0
      ? heroStats
      : [
          { value: "12K+", label: "Dues tracked" },
          { value: "98%", label: "On-time collections" },
          { value: "4.9", label: "User satisfaction" },
        ];

  return (
    <section className="relative px-4 pb-20 pt-28 sm:px-6 sm:pb-28 sm:pt-32 md:pb-32 md:pt-36">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
        <div className="landing-hero-in">
          <Badge variant="default" className="mb-6">
            <Sparkles className="mr-1.5 inline h-3 w-3" />
            {content.heroBadge || "Built for independent earners"}
          </Badge>

          <h1 className="landing-display max-w-xl text-4xl font-bold leading-[1.08] text-white sm:text-5xl md:text-[3.25rem]">
            {content.heroTitle || "The operating system for money you owe—and money owed to you."}
          </h1>

          <div
            className="mt-6 max-w-lg text-base leading-relaxed text-zinc-400 md:text-lg"
            dangerouslySetInnerHTML={{
              __html:
                content.heroDescription ||
                "<p>Track credits, debits, reminders, and payment history in one premium workspace—built for freelancers, founders, and anyone who manages real-world dues.</p>",
            }}
          />

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" asChild>
              <Link href="/signup">
                {content.ctaPrimary || "Create your account"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/login">{content.ctaSecondary || "Sign in"}</Link>
            </Button>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-4 gap-y-2">
            {TRUST.map((item) => (
              <li key={item} className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Shield className="h-3.5 w-3.5 text-emerald-500/80" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-4">
            {stats.map((stat, idx) => (
              <div
                key={`${stat.label}-${idx}`}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-4 sm:px-4"
              >
                <p className="text-xl font-semibold tabular-nums text-white sm:text-2xl">
                  <AnimatedCounter value={stat.value || "0"} />
                </p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500 sm:text-xs">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-hero-preview relative mx-auto w-full max-w-xl lg:max-w-none">
          <div className="landing-dashboard-glow pointer-events-none absolute -inset-8 rounded-[2rem] opacity-70" aria-hidden />

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/85 p-1 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-xs text-zinc-500">owedue.app/dashboard</span>
            </div>

            <div className="relative min-h-[320px] p-4 sm:min-h-[380px] sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Overview</p>
                  <p className="mt-1 text-2xl font-semibold text-white">$24,180</p>
                  <p className="text-xs text-emerald-400">+12.4% this month</p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300">
                    Export
                  </span>
                  <span className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-200">
                    New due
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Wallet, label: "Receivables", val: "$18.2k", color: "text-emerald-400" },
                  { icon: CreditCard, label: "Payables", val: "$6.1k", color: "text-amber-300" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                    <item.icon className={`mb-2 h-4 w-4 ${item.color}`} />
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">{item.label}</p>
                    <p className="text-lg font-semibold text-white">{item.val}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Cash flow</span>
                  <span className="text-emerald-400">Live</span>
                </div>
                <div className="mt-3 flex h-16 items-end gap-1" aria-hidden>
                  {CHART_HEIGHTS.map((h, i) => (
                    <div
                      key={i}
                      style={{ height: `${h}%` }}
                      className="flex-1 rounded-sm bg-linear-to-t from-amber-600/40 to-amber-400/90"
                    ></div>
                  ))}
                </div>
              </div>

              {FLOATING.map((card) => (
                <div
                  key={card.label}
                  className={`absolute hidden w-[168px] rounded-xl border border-white/10 bg-slate-900/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] sm:block ${card.className}`}
                >
                  <card.icon className={`mb-2 h-4 w-4 ${card.accent}`} />
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">{card.label}</p>
                  <p className="text-sm font-semibold text-white">{card.value}</p>
                  <p className="text-[10px] text-zinc-500">{card.sub}</p>
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/signup"
            className="absolute -bottom-3 right-4 hidden items-center gap-1 rounded-full border border-white/10 bg-slate-900/95 px-3 py-1.5 text-xs font-medium text-zinc-300 shadow-lg transition hover:border-amber-500/30 hover:text-white sm:flex"
          >
            Live preview
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
