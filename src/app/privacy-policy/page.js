import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";

export const metadata = {
  title: "Privacy Policy | MYOWEDUE",
  description: "Privacy policy for MYOWEDUE users.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <section className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <Link href="/" className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-300">
          Back to home
        </Link>
        <h1 className="mt-4 text-4xl text-stone-50">Privacy Policy</h1>
        <p className="mt-3 text-sm text-stone-300">Effective date: April 13, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-stone-300">
          <section>
            <h2 className="text-xl text-stone-50">1. Information We Collect</h2>
            <p className="mt-2">We collect account and transaction details you enter, including names, contact fields, transaction amounts, notes, and timeline events necessary for the service to function.</p>
          </section>

          <section>
            <h2 className="text-xl text-stone-50">2. How We Use Data</h2>
            <p className="mt-2">Data is used to provide core features such as transaction tracking, reminders, reports, restore functionality, and account security.</p>
          </section>

          <section>
            <h2 className="text-xl text-stone-50">3. Data Retention</h2>
            <p className="mt-2">Deleted items may remain in the bin for a limited recovery window. After that period, records can be permanently removed by system cleanup.</p>
          </section>

          <section>
            <h2 className="text-xl text-stone-50">4. Security</h2>
            <p className="mt-2">We use authentication controls and route protection to restrict access to your account data. You are responsible for maintaining the confidentiality of your login credentials.</p>
          </section>

          <section>
            <h2 className="text-xl text-stone-50">5. Contact</h2>
            <p className="mt-2">For privacy-related questions, visit the contact page or email the support address configured by your deployment.</p>
          </section>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
