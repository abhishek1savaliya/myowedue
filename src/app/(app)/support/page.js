import { redirect } from "next/navigation";
import { Crosshair, Mail, MessageCircle, ShieldCheck, Star } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { hasActivePremium } from "@/lib/subscription";

export const metadata = {
  title: "Premium Support",
  description: "Priority support for Pro subscribers.",
};

export default async function SupportPage() {
  const user = await getSessionUser();

  if (!user || !hasActivePremium(user)) {
    redirect("/settings");
  }

  const firstName = user.firstName || user.name?.split(" ")[0] || "there";

  return (
    <div
      className="relative -mx-4 w-[calc(100%+2rem)] max-w-none overflow-hidden rounded-2xl border border-slate-800/80 bg-[#070b12] px-4 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:-mx-8 md:w-[calc(100%+4rem)] md:px-8 md:py-10"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56, 189, 248, 0.12), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(245, 158, 11, 0.08), transparent)",
      }}
    >
      <header className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/35 p-6 md:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-sky-500 via-indigo-500 to-amber-400" />
        <div className="flex flex-col gap-5 pt-1 sm:gap-6 md:flex-row md:items-center md:gap-10 lg:gap-12">
          <p className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
            <Star className="h-3.5 w-3.5 fill-amber-400/80 text-amber-400" strokeWidth={1.5} />
            Premium Support
          </p>
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Dedicated help for <span className="text-sky-400">{firstName}</span>
          </h1>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 md:text-[15px]">
          Pro members get faster product guidance, premium onboarding help, export assistance, and recovery support.
        </p>
      </header>

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        <article className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 p-5 md:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-sky-400 via-blue-500 to-amber-400 opacity-90" />
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-500/35">
            <Crosshair className="h-5 w-5 text-amber-400" strokeWidth={2} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">Priority Queue</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Requests from premium members are handled first for billing, imports, exports, and recovery issues.
          </p>
        </article>
        <article className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 p-5 md:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-sky-400 via-blue-500 to-amber-400 opacity-90" />
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/35">
            <ShieldCheck className="h-5 w-5 text-emerald-400" strokeWidth={2} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">Recovery Help</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Get hands-on assistance for backup exports, premium bin recovery, and data restoration workflows.
          </p>
        </article>
        <article className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 p-5 md:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-sky-400 via-blue-500 to-amber-400 opacity-90" />
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500/15 ring-1 ring-sky-500/35">
            <MessageCircle className="h-5 w-5 text-sky-400" strokeWidth={2} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">Personalized Advice</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Ask for guidance on recurring dues, report exports, workflow setup, and premium feature usage.
          </p>
        </article>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-white">Contact Channels</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <a
            href="mailto:premium@myowedue.com"
            className="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 p-5 transition hover:border-amber-500/40 hover:bg-slate-900/60 md:p-6"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-sky-400 via-blue-500 to-amber-400 opacity-80" />
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-500/35">
              <Mail className="h-5 w-5 text-amber-400" strokeWidth={2} />
            </div>
            <p className="mt-4 text-base font-semibold text-white group-hover:text-amber-100">premium@myowedue.com</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              For account help, export issues, and personalized product support.
            </p>
          </a>
          <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 p-5 md:p-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-sky-400 via-blue-500 to-amber-400 opacity-80" />
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/35">
              <MessageCircle className="h-5 w-5 text-emerald-400" strokeWidth={2} />
            </div>
            <p className="mt-4 text-base font-semibold text-white">WhatsApp and SMS concierge</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              This workspace is prepared for premium reminder channels. Connect your provider credentials to enable live WhatsApp and SMS sending.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
