import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";

export const metadata = {
  title: "Contact Us | MYOWEDUE",
  description: "Contact the MYOWEDUE team.",
};

export default function ContactUsPage() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <section className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        <Link href="/" className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-300">
          Back to home
        </Link>

        <div className="mt-5 grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl border border-stone-700 bg-stone-900/70 p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">Contact us</p>
            <h1 className="mt-2 text-4xl text-stone-50">Need help with your account?</h1>
            <p className="mt-4 text-sm leading-7 text-stone-300">Tell us what you need, and our team will get back with setup, troubleshooting, or product guidance.</p>

            <div className="mt-6 grid gap-3 text-sm text-stone-200">
              <p className="rounded-xl border border-stone-700 bg-stone-900 px-4 py-3">Product help: support@myowedue.com</p>
              <p className="rounded-xl border border-stone-700 bg-stone-900 px-4 py-3">Billing queries: billing@myowedue.com</p>
              <p className="rounded-xl border border-stone-700 bg-stone-900 px-4 py-3">Partnerships: partners@myowedue.com</p>
            </div>
          </article>

          <article className="rounded-3xl border border-stone-700 bg-stone-900/70 p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Quick message</p>
            <form className="mt-4 space-y-3">
              <input
                type="text"
                placeholder="Your name"
                className="w-full rounded-xl border border-stone-600 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500"
              />
              <input
                type="email"
                placeholder="Your email"
                className="w-full rounded-xl border border-stone-600 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500"
              />
              <textarea
                rows={5}
                placeholder="How can we help?"
                className="w-full rounded-xl border border-stone-600 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500"
              />
              <button
                type="button"
                className="w-full rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-stone-900 transition hover:bg-amber-200"
              >
                Send message
              </button>
            </form>
          </article>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
