import { redirect } from "next/navigation";
import { LifeBuoy, Mail, MessageCircleMore, ShieldCheck, Sparkles } from "lucide-react";
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
    <div className="space-y-6">
      <header className="rounded-3xl border border-amber-200 bg-linear-to-br from-amber-50 via-white to-emerald-50 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
        <p className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
          <Sparkles className="h-3.5 w-3.5" />
          Premium Support
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-black">Dedicated help for {firstName}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-600">
          Pro members get faster product guidance, premium onboarding help, export assistance, and recovery support.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
          <LifeBuoy className="h-5 w-5 text-amber-600" />
          <h2 className="mt-4 text-lg font-semibold text-black">Priority Queue</h2>
          <p className="mt-2 text-sm text-zinc-600">Requests from premium members are handled first for billing, imports, exports, and recovery issues.</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <h2 className="mt-4 text-lg font-semibold text-black">Recovery Help</h2>
          <p className="mt-2 text-sm text-zinc-600">Get hands-on assistance for backup exports, premium bin recovery, and data restoration workflows.</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
          <MessageCircleMore className="h-5 w-5 text-sky-600" />
          <h2 className="mt-4 text-lg font-semibold text-black">Personalized Advice</h2>
          <p className="mt-2 text-sm text-zinc-600">Ask for guidance on recurring dues, report exports, workflow setup, and premium feature usage.</p>
        </article>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
        <h2 className="text-xl font-semibold text-black">Contact Channels</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <a href="mailto:premium@myowedue.com" className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 transition hover:border-amber-300 hover:bg-white">
            <Mail className="h-5 w-5 text-amber-600" />
            <p className="mt-3 text-sm font-semibold text-black">premium@myowedue.com</p>
            <p className="mt-1 text-sm text-zinc-600">For account help, export issues, and personalized product support.</p>
          </a>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <MessageCircleMore className="h-5 w-5 text-emerald-600" />
            <p className="mt-3 text-sm font-semibold text-black">WhatsApp and SMS concierge</p>
            <p className="mt-1 text-sm text-zinc-600">This workspace is prepared for premium reminder channels. Connect your provider credentials to enable live WhatsApp and SMS sending.</p>
          </div>
        </div>
      </section>
    </div>
  );
}