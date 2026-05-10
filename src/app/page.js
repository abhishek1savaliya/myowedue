import { cookies } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import PublicFooter from "@/components/PublicFooter";
import PublicModeToggle from "@/components/PublicModeToggle";
import HomeTrendingSection from "@/components/HomeTrendingSection";
import HomeLogoThree from "@/components/HomeLogoThree";
import { ArrowRight } from "lucide-react";
import { getCmsPageContent } from "@/lib/cmsPublic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://myowedue.vercel.app";

export const metadata = {
  title: "Personal Credit & Debit Tracker",
  description:
    "Manage dues, reminders, events, and payment history in one premium workspace with OWE DUE.",
  alternates: {
    canonical: "/",
  },
};

export default async function Home() {
  const store = await cookies();
  const token = store.get("session_token")?.value;

  if (token) {
    redirect("/dashboard");
  }

  const { content } = await getCmsPageContent("home");
  const features = Array.isArray(content.features) ? content.features : [];
  const heroStats = Array.isArray(content.heroStats) ? content.heroStats : [];
  const highlightItems = Array.isArray(content.highlightItems) ? content.highlightItems : [];
  const howItWorksSteps = Array.isArray(content.howItWorksSteps) ? content.howItWorksSteps : [];
  const whyChooseItems = Array.isArray(content.whyChooseItems) ? content.whyChooseItems : [];
  const securityItems = Array.isArray(content.securityItems) ? content.securityItems : [];
  const freePlan = content.freePlan && typeof content.freePlan === "object" ? content.freePlan : {};
  const paidPlan = content.paidPlan && typeof content.paidPlan === "object" ? content.paidPlan : {};
  const freePlanFeatures = Array.isArray(freePlan.features) ? freePlan.features : [];
  const paidPlanFeatures = Array.isArray(paidPlan.features) ? paidPlan.features : [];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "OWE DUE",
        url: siteUrl,
        logo: `${siteUrl}/owedue-logo.svg`,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "OWE DUE",
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "en",
      },
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/#home`,
        url: siteUrl,
        name: "OWE DUE | Personal Credit & Debit Tracker",
        description:
          "Track credits, debits, reminders, and due history in one premium workspace.",
        isPartOf: { "@id": `${siteUrl}/#website` },
        about: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "ItemList",
        "@id": `${siteUrl}/#site-navigation`,
        itemListElement: [
          { "@type": "SiteNavigationElement", position: 1, name: "Login", url: `${siteUrl}/login` },
          { "@type": "SiteNavigationElement", position: 2, name: "Sign up", url: `${siteUrl}/signup` },
          { "@type": "SiteNavigationElement", position: 3, name: "Privacy Policy", url: `${siteUrl}/privacy-policy` },
          { "@type": "SiteNavigationElement", position: 4, name: "Contact", url: `${siteUrl}/contact-us` },
        ],
      },
    ],
  };

  return (
    <main className="relative overflow-hidden bg-linear-to-b from-background via-background to-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="frontpage-aurora pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(245,158,11,0.14),transparent_34%),radial-gradient(circle_at_84%_84%,rgba(16,185,129,0.12),transparent_34%)]" />

      <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 md:pb-20 md:pt-14">
        <header className="frontpage-reveal flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Image
              src="/owedue-logo.svg"
              alt="OWE DUE logo"
              width={40}
              height={40}
              className="h-9 w-9 rounded-lg sm:h-10 sm:w-10"
              priority
            />
            <div className="min-w-0">
              <p className="text-lg font-bold tracking-[0.12em] text-black sm:text-xl">OWE DUE</p>
              <p className="truncate text-[11px] text-zinc-600 sm:text-xs">Personal credit and debit tracker</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PublicModeToggle />
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-300 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700 transition hover:border-amber-400 hover:text-amber-600 sm:px-4"
            >
              Login
            </Link>
          </div>
        </header>

        <div className="frontpage-reveal frontpage-delay-1 mt-6 flex justify-center md:mt-8">
          <HomeLogoThree size={132} />
        </div>

        <div className="mt-12 grid gap-10 md:mt-16 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div className="frontpage-reveal frontpage-delay-1">
            <p className="frontpage-badge inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
              {content.heroBadge || "Built for independent earners"}
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl leading-tight text-black md:text-5xl">
              {content.heroTitle || "Track every due without the chaos."}
            </h1>
            <div className="mt-5 max-w-2xl text-sm leading-7 text-zinc-600 md:text-base cms-html" dangerouslySetInnerHTML={{ __html: content.heroDescription || "Manage dues in one premium workspace." }} />

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/signup"
                className="frontpage-primary-cta inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-amber-400 to-amber-500 px-5 py-3 text-sm font-semibold text-white transition hover:from-amber-500 hover:to-amber-600 sm:w-auto"
              >
                {content.ctaPrimary || "Create your account"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 sm:w-auto"
              >
                {content.ctaSecondary || "Already have an account"}
              </Link>
            </div>

            {heroStats.length ? (
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {heroStats.map((stat, idx) => (
                  <div
                    key={`${stat.label || "stat"}-${idx}`}
                    className="frontpage-lift frontpage-stat rounded-2xl border border-zinc-200 bg-white/80 px-4 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
                    style={{ "--frontpage-delay": `${180 + idx * 90}ms` }}
                  >
                    <p className="text-2xl font-bold text-black">{stat.value || "-"}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{stat.label || "Label"}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="frontpage-reveal frontpage-delay-2 frontpage-lift rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{content.highlightTitle || "Try now"}</p>
            <div className="mt-4 space-y-3 text-sm text-zinc-700">
              {highlightItems.length ? (
                highlightItems.map((item, idx) => (
                  <p key={`${item}-${idx}`} className="frontpage-highlight rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                    {item}
                  </p>
                ))
              ) : (
                <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">No highlights configured yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-4 pb-10 pt-2 sm:px-6 md:pb-14 md:pt-0">
        <HomeTrendingSection />
      </section>

      <section className="relative border-y border-zinc-200 bg-white/50">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">{content.featuresEyebrow || "Explore features"}</p>
          <h2 className="mt-2 text-3xl font-bold text-black md:text-4xl">
            {content.featuresTitle || "Everything you need in one workspace"}
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {features.length ? (
              features.map((feature, idx) => (
                <article key={`${feature.title || "feature"}-${idx}`} className="frontpage-lift rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">{feature.eyebrow || "Feature"}</p>
                  <h3 className="text-lg font-bold text-black">{feature.title || "Feature"}</h3>
                  <div className="mt-2 text-sm leading-6 text-zinc-600 cms-html" dangerouslySetInnerHTML={{ __html: feature.description || "Description" }} />
                </article>
              ))
            ) : (
              <p className="text-sm text-zinc-600">No features configured yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 py-14 md:py-16">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="frontpage-lift rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">{content.howItWorksEyebrow || "How it works"}</p>
            <h2 className="mt-2 text-3xl font-bold text-black">{content.howItWorksTitle || "From signup to control"}</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {howItWorksSteps.length ? (
              howItWorksSteps.map((step, idx) => (
                <div key={`${step}-${idx}`} className="frontpage-lift rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Step {idx + 1}</p>
                  <p className="mt-3 text-base font-semibold text-black">{step}</p>
                </div>
              ))
            ) : null}
          </div>
        </div>
      </section>

      <section className="relative border-y border-zinc-200 bg-white/50">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-14 md:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">{content.whyChooseEyebrow || "Why choose us"}</p>
            <h2 className="mt-2 text-3xl font-bold text-black">{content.whyChooseTitle || "Built to feel effortless"}</h2>
          </div>
          <div className="grid gap-3">
            {whyChooseItems.length ? (
              whyChooseItems.map((item, idx) => (
                <div key={`${item}-${idx}`} className="frontpage-lift rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                  <p className="text-sm font-semibold text-black">{`✓ ${item}`}</p>
                </div>
              ))
            ) : null}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 py-14 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">{content.securityEyebrow || "Trust & Security"}</p>
        <h2 className="mt-2 text-3xl font-bold text-black md:text-4xl">{content.securityTitle || "Your data, protected"}</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {securityItems.length ? (
            securityItems.map((item, idx) => (
              <article key={`${item.title || "security"}-${idx}`} className="frontpage-lift rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <h3 className="text-lg font-bold text-black">{item.title || "Security item"}</h3>
                <div className="mt-2 text-sm leading-6 text-zinc-600 cms-html" dangerouslySetInnerHTML={{ __html: item.description || "" }} />
              </article>
            ))
          ) : null}
        </div>
      </section>

      <section className="relative border-y border-zinc-200/90 bg-[color-mix(in_srgb,var(--surface)_82%,var(--background))] dark:border-zinc-800/90 dark:bg-[color-mix(in_srgb,var(--surface)_55%,var(--background))]">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
            {content.plansEyebrow || "Plans"}
          </p>
          <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-foreground md:text-4xl">
                {content.plansTitle || "Choose the plan that fits your workflow"}
              </h2>
              <div
                className="mt-3 max-w-2xl text-sm leading-7 text-zinc-700 dark:text-zinc-400 md:text-base cms-html"
                dangerouslySetInnerHTML={{
                  __html:
                    content.plansDescription ||
                    "Start free, then move to Pro when you need premium exports, recurring dues, and advanced reminders.",
                }}
              />
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <article className="frontpage-lift rounded-3xl border border-zinc-200 bg-[var(--surface)] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:border-zinc-700 dark:shadow-[0_12px_40px_rgba(0,0,0,0.25)] md:p-7">
              <p className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:border-zinc-600 dark:bg-slate-800/80 dark:text-zinc-300">
                {freePlan.badge || "Free Plan"}
              </p>
              <h3 className="mt-4 text-2xl font-bold text-foreground">{freePlan.name || "Free"}</h3>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-4xl font-bold text-foreground">{freePlan.price || "$0"}</span>
                <span className="pb-1 text-sm font-semibold text-zinc-500 dark:text-zinc-400">{freePlan.billing || "/forever"}</span>
              </div>
              <div
                className="mt-4 text-sm leading-7 text-zinc-600 dark:text-zinc-400 cms-html"
                dangerouslySetInnerHTML={{
                  __html:
                    freePlan.description ||
                    "Best for getting started with personal due tracking and everyday reminders.",
                }}
              />
              <div className="mt-5 space-y-3">
                {freePlanFeatures.map((item, idx) => (
                  <div
                    key={`${item}-${idx}`}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50/90 px-4 py-3 text-sm font-medium text-zinc-800 dark:border-zinc-600/90 dark:bg-slate-800/70 dark:text-zinc-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <Link
                href={freePlan.ctaHref || "/signup"}
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-stone-800/20 bg-white px-5 py-3 text-sm font-semibold text-stone-900 shadow-sm transition hover:border-stone-800/35 hover:bg-stone-50 dark:border-zinc-600 dark:bg-slate-900/80 dark:text-zinc-100 dark:hover:bg-slate-800/80"
              >
                {freePlan.ctaLabel || "Get started free"}
              </Link>
            </article>

            <article className="frontpage-lift frontpage-pro-card relative overflow-hidden rounded-3xl border-2 border-amber-400/50 bg-[var(--surface)] p-6 shadow-[0_10px_36px_rgba(245,158,11,0.14)] dark:border-amber-500/40 dark:shadow-[0_12px_44px_rgba(245,158,11,0.18)] md:p-7">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-amber-500 via-amber-400 to-emerald-500 opacity-90" />
              <p className="inline-flex rounded-full border border-amber-300/80 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800 dark:border-amber-500/45 dark:bg-amber-500/15 dark:text-amber-300">
                {paidPlan.badge || "Pro Plan"}
              </p>
              <h3 className="mt-4 text-2xl font-bold text-foreground">{paidPlan.name || "Pro"}</h3>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-4xl font-bold text-foreground">{paidPlan.price || "$7"}</span>
                <span className="pb-1 text-sm font-semibold text-zinc-500 dark:text-zinc-400">{paidPlan.billing || "/month or $70/year"}</span>
              </div>
              <div
                className="mt-4 text-sm leading-7 text-zinc-700 dark:text-zinc-300 cms-html"
                dangerouslySetInnerHTML={{
                  __html:
                    paidPlan.description ||
                    "Built for users who need unlimited growth, premium exports, recurring dues, and better payment collection tools.",
                }}
              />
              <div className="mt-5 space-y-3">
                {paidPlanFeatures.map((item, idx) => (
                  <div
                    key={`${item}-${idx}`}
                    className="rounded-2xl border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-sm font-medium text-stone-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-zinc-100"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <Link
                href={paidPlan.ctaHref || "/signup"}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:from-amber-600 hover:to-amber-700"
              >
                {paidPlan.ctaLabel || "View Pro options"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          </div>

          {content.plansFootnote?.trim() ? (
            <p className="mt-5 text-sm text-zinc-700 dark:text-zinc-500">{content.plansFootnote.trim()}</p>
          ) : null}
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 py-14 md:py-20">
        <div className="frontpage-lift frontpage-final-cta relative overflow-hidden rounded-2xl border border-zinc-200 bg-[var(--surface)] p-7 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:border-zinc-700 dark:shadow-[0_12px_40px_rgba(0,0,0,0.3)] md:flex md:items-center md:justify-between md:p-10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-amber-500 via-amber-400 to-emerald-500 opacity-85" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">Ready to get started?</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">
              {content.finalCtaTitle || "Join thousands of users tracking dues effortlessly."}
            </h2>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap md:mt-0 md:flex-nowrap">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:from-amber-600 hover:to-amber-700 sm:w-auto"
            >
              Get started free
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-slate-800/80 sm:w-auto"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <div className="relative mx-auto max-w-6xl px-6 py-5 md:py-6" role="separator" aria-hidden="true">
        <hr className="h-px w-full border-0 bg-zinc-200 dark:bg-zinc-700" />
      </div>

      <section className="relative mx-auto max-w-6xl px-6 pb-14 md:pb-20">
        <div className="frontpage-lift relative overflow-hidden rounded-2xl border border-zinc-200 bg-[var(--surface)] p-7 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:border-zinc-700 dark:shadow-[0_12px_40px_rgba(0,0,0,0.3)] md:flex md:items-center md:justify-between md:gap-10 md:p-10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-emerald-500 via-amber-400 to-amber-500 opacity-85" />
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
              {content.communityEyebrow || "Connect to community"}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-foreground md:text-3xl">
              {content.communityTitle || "Learn from others and share what works for you"}
            </h2>
            <div
              className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300 cms-html"
              dangerouslySetInnerHTML={{
                __html:
                  content.communityDescription ||
                  "<p>Join discussions, ask questions, and see how people stay organized with dues and reminders.</p>",
              }}
            />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap md:mt-0 md:justify-end">
            <Link
              href={content.communityCtaPrimaryHref || "/signup"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:from-amber-600 hover:to-amber-700 sm:w-auto"
            >
              {content.communityCtaPrimaryLabel || "Get started free"}
            </Link>
            <Link
              href={content.communityCtaSecondaryHref || "/login?next=/community"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-slate-800/80 sm:w-auto"
            >
              {content.communityCtaSecondaryLabel || "Sign in to join"}
            </Link>
            <Link
              href={content.communityCtaCommunityHref || "/community"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-600/50 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-500/15 dark:border-emerald-500/45 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15 sm:w-auto"
            >
              {content.communityCtaCommunityLabel || "Connect Community"}
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
