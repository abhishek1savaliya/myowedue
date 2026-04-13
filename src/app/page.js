import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import PublicFooter from "@/components/PublicFooter";

export default async function Home() {
  const store = await cookies();
  const token = store.get("session_token")?.value;

  if (token) {
    redirect("/dashboard");
  }

  return (
    <main className="relative overflow-hidden bg-stone-950 text-stone-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,0.16),transparent_38%),radial-gradient(circle_at_82%_72%,rgba(16,185,129,0.18),transparent_36%)]" />

      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-10 md:pb-20 md:pt-14">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">MYOWEDUE</p>
            <p className="text-[11px] text-stone-300">Personal credit and debit command center</p>
          </div>
          <div className="hidden items-center gap-5 text-xs font-semibold uppercase tracking-[0.12em] text-stone-300 md:flex">
            <a href="#features" className="transition hover:text-amber-200">Features</a>
            <a href="#workflow" className="transition hover:text-amber-200">Workflow</a>
            <a href="#security" className="transition hover:text-amber-200">Security</a>
          </div>
          <div className="flex gap-2">
            <Link
              href="/login"
              className="rounded-full border border-stone-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-200 transition hover:border-amber-300 hover:text-amber-200"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-amber-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-900 transition hover:bg-amber-200"
            >
              Start Free
            </Link>
          </div>
        </header>

        <div className="mt-12 grid gap-10 md:mt-16 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div>
            <p className="inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
              Built for independent earners
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl leading-tight text-stone-50 md:text-6xl">
              Stop losing money in scattered chats and forgotten tabs.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-stone-200 md:text-base">
              Track every debit and credit, send reminders, export reports, and keep a complete change history in one premium, fast workspace.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-semibold text-stone-900 transition hover:bg-amber-200"
              >
                Create your account
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-stone-600 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-amber-300"
              >
                I already have an account
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-stone-700 bg-stone-900/70 p-5 backdrop-blur md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-300">What you get</p>
            <div className="mt-4 space-y-3 text-sm text-stone-100">
              <p className="rounded-xl border border-stone-700 bg-stone-800/80 px-3 py-2">Unlimited people and transactions</p>
              <p className="rounded-xl border border-stone-700 bg-stone-800/80 px-3 py-2">One-tap paid status and deletion bin recovery</p>
              <p className="rounded-xl border border-stone-700 bg-stone-800/80 px-3 py-2">Auto reminders and export-ready reports</p>
              <p className="rounded-xl border border-stone-700 bg-stone-800/80 px-3 py-2">Detailed timeline for every transaction update</p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-3 rounded-2xl border border-stone-700/80 bg-stone-900/70 p-4 text-center md:grid-cols-3 md:p-6">
          <div>
            <p className="text-2xl font-semibold text-amber-300">3 minutes</p>
            <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Setup time</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-emerald-300">Unlimited</p>
            <p className="text-xs uppercase tracking-[0.12em] text-stone-400">People and transactions</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-cyan-300">Full timeline</p>
            <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Created, edited, deleted, restored</p>
          </div>
        </div>
      </section>

      <section id="features" className="relative border-y border-stone-800 bg-stone-900/70">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Explore the app</p>
              <h2 className="mt-2 text-3xl text-stone-50 md:text-4xl">Everything you need in one flow</h2>
            </div>
            <Link href="/signup" className="hidden rounded-xl border border-stone-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-200 md:inline-flex">
              Try it now
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-stone-700 bg-stone-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">People Ledger</p>
            <h2 className="mt-2 text-2xl text-stone-50">Clean relationship view</h2>
            <p className="mt-3 text-sm leading-6 text-stone-300">See everyone who owes you or whom you owe, with their due totals and latest activity in seconds.</p>
          </article>
          <article className="rounded-2xl border border-stone-700 bg-stone-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">Transaction Timeline</p>
            <h2 className="mt-2 text-2xl text-stone-50">Never lose context</h2>
            <p className="mt-3 text-sm leading-6 text-stone-300">Every update, mark-paid event, delete, and restore can be tracked with clear date-time history.</p>
          </article>
          <article className="rounded-2xl border border-stone-700 bg-stone-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Reports + Export</p>
            <h2 className="mt-2 text-2xl text-stone-50">Ready for sharing</h2>
            <p className="mt-3 text-sm leading-6 text-stone-300">Export PDFs and summaries for monthly reviews, partner updates, and bookkeeping snapshots.</p>
          </article>
          <article className="rounded-2xl border border-stone-700 bg-stone-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-300">Reminder Engine</p>
            <h2 className="mt-2 text-2xl text-stone-50">Nudge without awkward follow-ups</h2>
            <p className="mt-3 text-sm leading-6 text-stone-300">Send polite reminder emails in one click and keep payment communication professional.</p>
          </article>
          <article className="rounded-2xl border border-stone-700 bg-stone-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-300">Deletion Bin</p>
            <h2 className="mt-2 text-2xl text-stone-50">Safe recovery for mistakes</h2>
            <p className="mt-3 text-sm leading-6 text-stone-300">Deleted people and transactions can be restored, with full record continuity and timeline visibility.</p>
          </article>
          <article className="rounded-2xl border border-stone-700 bg-stone-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lime-300">Smart Filters</p>
            <h2 className="mt-2 text-2xl text-stone-50">Find any due instantly</h2>
            <p className="mt-3 text-sm leading-6 text-stone-300">Filter by date, status, type, and person so your important entries are never buried.</p>
          </article>
          </div>
        </div>
      </section>

      <section id="workflow" className="relative mx-auto max-w-6xl px-6 py-14 md:py-20">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-stone-700/80 bg-stone-900/70 p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">How it works</p>
            <h2 className="mt-2 text-3xl text-stone-50">From signup to control in four steps</h2>
            <ol className="mt-5 space-y-4 text-sm text-stone-300">
              <li className="rounded-xl border border-stone-700 bg-stone-900/80 px-4 py-3">1. Create your account and add people you deal with.</li>
              <li className="rounded-xl border border-stone-700 bg-stone-900/80 px-4 py-3">2. Add debit or credit transactions with notes and dates.</li>
              <li className="rounded-xl border border-stone-700 bg-stone-900/80 px-4 py-3">3. Mark payments, send reminders, and recover from bin if needed.</li>
              <li className="rounded-xl border border-stone-700 bg-stone-900/80 px-4 py-3">4. Track full history and export clean reports anytime.</li>
            </ol>
          </div>
          <div className="rounded-3xl border border-stone-700/80 bg-stone-900/70 p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Why people choose it</p>
            <div className="mt-4 space-y-4 text-sm text-stone-300">
              <p className="rounded-xl border border-stone-700 bg-stone-900/80 px-4 py-3">Purpose-built for personal dues, not generic accounting dashboards.</p>
              <p className="rounded-xl border border-stone-700 bg-stone-900/80 px-4 py-3">Premium, clear interface that works fast on desktop and mobile.</p>
              <p className="rounded-xl border border-stone-700 bg-stone-900/80 px-4 py-3">Timeline and status logic make every change traceable and trustworthy.</p>
              <p className="rounded-xl border border-stone-700 bg-stone-900/80 px-4 py-3">Great for freelancers, households, small teams, and side-business operators.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="security" className="relative border-y border-stone-800 bg-stone-900/70">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Trust and privacy</p>
          <h2 className="mt-2 text-3xl text-stone-50 md:text-4xl">Built with privacy and control in mind</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-stone-700 bg-stone-900 p-5 text-sm text-stone-300">
              <h3 className="text-lg text-stone-50">Session protection</h3>
              <p className="mt-2">Authenticated routes are protected so your data stays in your account boundary.</p>
            </article>
            <article className="rounded-2xl border border-stone-700 bg-stone-900 p-5 text-sm text-stone-300">
              <h3 className="text-lg text-stone-50">Safe delete and restore</h3>
              <p className="mt-2">Bin workflows let you recover records while preserving historical context.</p>
            </article>
            <article className="rounded-2xl border border-stone-700 bg-stone-900 p-5 text-sm text-stone-300">
              <h3 className="text-lg text-stone-50">Transparent timelines</h3>
              <p className="mt-2">Action logs help you understand exactly what changed and when.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 py-14 md:py-20">
        <div className="rounded-3xl border border-amber-300/40 bg-linear-to-r from-amber-300/20 to-emerald-300/20 p-7 md:flex md:items-center md:justify-between md:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-200">Launch in under 2 minutes</p>
            <h2 className="mt-2 text-3xl text-stone-50 md:text-4xl">Your premium due tracker starts now.</h2>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 md:mt-0">
            <Link
              href="/signup"
              className="inline-flex rounded-xl bg-stone-100 px-5 py-3 text-sm font-semibold text-stone-900 transition hover:bg-white"
            >
              Sign up and continue
            </Link>
            <Link
              href="/contact-us"
              className="inline-flex rounded-xl border border-stone-200/70 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-white"
            >
              Contact us
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
