import BackButton from "@/components/BackButton";
import PublicFooter from "@/components/PublicFooter";
import AmbientBackground from "@/components/shell/AmbientBackground";
import { getCmsPageContent } from "@/lib/cmsPublic";

export const metadata = {
  title: "Privacy policy",
  description:
    "Read how OWE DUE collects, stores, and protects your personal data, cookies, and account information.",
  alternates: { canonical: "/privacy-policy" },
};

export default async function PrivacyPolicyPage() {
  const { content } = await getCmsPageContent("privacy-policy");
  const sections = Array.isArray(content.sections) ? content.sections : [];

  return (
    <main className="ui-v2-page relative min-h-screen bg-[#030712] text-zinc-100">
      <AmbientBackground />
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-12 md:py-16">
        <BackButton href="/" label="Back to home" className="text-xs uppercase tracking-wide" />
        <h1 className="mt-4 text-4xl text-black">{content.heading || "Privacy Policy"}</h1>
        <p className="mt-3 text-sm text-zinc-600">Effective date: {content.effectiveDate || "April 13, 2026"}</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-zinc-600">
          {sections.length ? (
            sections.map((section, idx) => (
              <section key={`${section.title || "section"}-${idx}`}>
                <h2 className="text-xl text-black">{section.title || `Section ${idx + 1}`}</h2>
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
