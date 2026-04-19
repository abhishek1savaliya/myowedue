import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import PublicFooter from "@/components/PublicFooter";
import { ArrowRight, Users, Clock, FileText, Bell, Trash2, Filter, Lock, Shield, ArrowUpRight } from "lucide-react";

export default async function Home() {
  const store = await cookies();
  const token = store.get("session_token")?.value;

  if (token) {
    redirect("/dashboard");
  }

  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-background via-background to-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(245,158,11,0.14),transparent_34%),radial-gradient(circle_at_84%_84%,rgba(16,185,129,0.12),transparent_34%)]" />

      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-10 md:pb-20 md:pt-14">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xl font-bold tracking-[0.18em] text-black">OWE DUE</p>
            <p className="text-xs text-zinc-600">Personal credit and debit tracker</p>
          </div>
          <div className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600 md:flex">
            <a href="#features" className="transition hover:text-amber-600">Features</a>
            <a href="#workflow" className="transition hover:text-emerald-600">How it works</a>
            <a href="#security" className="transition hover:text-amber-600">Security</a>
          </div>
          <div className="flex gap-2">
            <Link
              href="/login"
              className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700 transition hover:border-amber-400 hover:text-amber-600"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:from-emerald-500 hover:to-emerald-600"
            >
              Get Started
            </Link>
          </div>
        </header>

        <div className="mt-12 grid gap-10 md:mt-16 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div>
            <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
              ✓ Built for independent earners
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl leading-tight text-black md:text-5xl">
              Track every rupee, rupee, without the chaos.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-600 md:text-base">
              Manage who owes you and what you owe. Send reminders, export reports, keep complete history—all in one premium workspace.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-3 text-sm font-semibold text-white transition hover:from-amber-500 hover:to-amber-600"
              >
                Create your account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Already have an account
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">What you get</p>
            <div className="mt-4 space-y-3 text-sm text-zinc-700">
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">✓ Unlimited people & transactions</p>
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">✓ Paid status & deletion recovery</p>
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">✓ Auto reminders & smart exports</p>
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">✓ Full timeline & activity logs</p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:grid-cols-3 md:p-6">
          <div>
            <p className="text-2xl font-semibold text-amber-600">3 min</p>
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Setup time</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-emerald-600">∞</p>
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">People & transactions</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-amber-600">100%</p>
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Historical tracking</p>
          </div>
        </div>
      </section>

      <section id="features" className="relative border-y border-zinc-200 bg-white/50">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">Explore features</p>
              <h2 className="mt-2 text-3xl font-bold text-black md:text-4xl">Everything you need in one workspace</h2>
            </div>
            <Link href="/signup" className="hidden rounded-xl border border-zinc-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700 hover:bg-zinc-50 md:inline-flex">
              Try now
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">People Ledger</p>
            </div>
            <h3 className="mt-3 text-lg font-bold text-black">Clean relationship view</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">See who owes you and what you owe in one glance, with due totals and latest activity.</p>
          </article>
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2">
                <Clock className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Timeline</p>
            </div>
            <h3 className="mt-3 text-lg font-bold text-black">Never lose context</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Every update, payment, delete, and restore with clear date-time history you can trust.</p>
          </article>
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Reports</p>
            </div>
            <h3 className="mt-3 text-lg font-bold text-black">Export & share</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">PDF and CSV exports for reviews, bookkeeping snapshots, and professional sharing.</p>
          </article>
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-rose-100 p-2">
                <Bell className="h-5 w-5 text-rose-600" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-600">Reminders</p>
            </div>
            <h3 className="mt-3 text-lg font-bold text-black">Smart reminders</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Send polite reminder emails with one click, keeping payment communication professional.</p>
          </article>
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-100 p-2">
                <Trash2 className="h-5 w-5 text-violet-600" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Deletion Bin</p>
            </div>
            <h3 className="mt-3 text-lg font-bold text-black">Safe recovery</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Recover deleted records anytime with full historical context and timeline preserved.</p>
          </article>
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-lime-100 p-2">
                <Filter className="h-5 w-5 text-lime-600" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lime-600">Smart Filters</p>
            </div>
            <h3 className="mt-3 text-lg font-bold text-black">Find instantly</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Filter by date, status, type, and person to find any entry in seconds.</p>
          </article>
          </div>
        </div>
      </section>

      <section id="workflow" className="relative mx-auto max-w-6xl px-6 py-14 md:py-20">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">How it works</p>
            <h2 className="mt-3 text-2xl font-bold text-black">From signup to control</h2>
            <ol className="mt-5 space-y-4 text-sm text-zinc-700">
              <li className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-medium">1. Create account and add people</li>
              <li className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-medium">2. Log debit/credit transactions</li>
              <li className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-medium">3. Mark paid, send reminders, recover</li>
              <li className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-medium">4. Export reports & track history</li>
            </ol>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">Why choose us</p>
            <div className="mt-4 space-y-4 text-sm text-zinc-700">
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-medium">✓ Purpose-built for personal dues</p>
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-medium">✓ Premium interface, fast & mobile-friendly</p>
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-medium">✓ Transparent, traceable history</p>
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-medium">✓ Perfect for freelancers & households</p>
            </div>
          </div>
        </div>
      </section>

      <section id="security" className="relative border-y border-zinc-200 bg-white/50">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">Trust & Security</p>
          <h2 className="mt-2 text-3xl font-bold text-black md:text-4xl">Your data, protected</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] text-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 p-2">
                  <Lock className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-bold text-black">Session protection</h3>
              </div>
              <p className="mt-3 text-zinc-600">Authenticated routes and secure cookies keep your data in your account.</p>
            </article>
            <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] text-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-100 p-2">
                  <Trash2 className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="font-bold text-black">Safe deletion</h3>
              </div>
              <p className="mt-3 text-zinc-600">Recovery workflows preserve your history and let you undo mistakes.</p>
            </article>
            <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] text-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-100 p-2">
                  <Shield className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="font-bold text-black">Audit logs</h3>
              </div>
              <p className="mt-3 text-zinc-600">Complete transparency on what changed and when, with full traceability.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 py-14 md:py-20">
        <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-amber-50 p-7 shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:flex md:items-center md:justify-between md:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">Ready to get started?</p>
            <h2 className="mt-2 text-2xl font-bold text-black md:text-3xl">Join thousands of users tracking dues effortlessly.</h2>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 md:mt-0 md:flex-nowrap">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:from-emerald-500 hover:to-emerald-600"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Sign in
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
