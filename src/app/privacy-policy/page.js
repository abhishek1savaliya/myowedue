import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";
import { getCmsPageContent } from "@/lib/cmsPublic";

export const metadata = {
  title: "Privacy Policy | MYOWEDUE",
  description: "Privacy policy for MYOWEDUE users.",
};

export default async function PrivacyPolicyPage() {
  const { content } = await getCmsPageContent("privacy-policy");
  const sections = Array.isArray(content.sections) ? content.sections : [];

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <section className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <Link href="/" className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-300">
          Back to home
        </Link>
        <h1 className="mt-4 text-4xl text-stone-50">{content.heading || "Privacy Policy"}</h1>
        <p className="mt-3 text-sm text-stone-300">Effective date: {content.effectiveDate || "April 13, 2026"}</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-stone-300">
          {sections.length ? (
            sections.map((section, idx) => (
              <section key={`${section.title || "section"}-${idx}`}>
                <h2 className="text-xl text-stone-50">{section.title || `Section ${idx + 1}`}</h2>
                <div className="mt-2 cms-html" dangerouslySetInnerHTML={{ __html: section.body || "" }} />
              </section>
            ))
          ) : (
            <p>No policy sections are published yet.</p>
          )}
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
