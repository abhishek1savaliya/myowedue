import Link from "next/link";
import { ArrowRight, Layers, Sparkles, Zap } from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingHero from "@/components/landing/LandingHero";
import LandingSectionHeading from "@/components/landing/LandingSectionHeading";
import LandingPricingCard from "@/components/landing/LandingPricingCard";
import LandingWorkflowTabs from "@/components/landing/LandingWorkflowTabs";
import LandingTrendingBlock from "@/components/landing/LandingTrendingBlock";
import SpotlightCard from "@/components/landing/SpotlightCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DEFAULT_FEATURES, DEFAULT_SECURITY } from "@/lib/landing-defaults";
import { landingH3, landingMuted, landingMutedSm, landingSeparator } from "@/lib/landing-classes";
import { cn } from "@/lib/utils";

export default function LandingPage({
  content = {},
  features = [],
  heroStats = [],
  howItWorksSteps = [],
  securityItems = [],
  freePlan = {},
  paidPlan = {},
}) {
  const featureList =
    features.length > 0
      ? features.map((f, i) => ({
          ...DEFAULT_FEATURES[i % DEFAULT_FEATURES.length],
          eyebrow: f.eyebrow || DEFAULT_FEATURES[i % DEFAULT_FEATURES.length].eyebrow,
          title: f.title || "Feature",
          description: f.description?.replace(/<[^>]+>/g, "") || "",
          span: DEFAULT_FEATURES[i % DEFAULT_FEATURES.length].span,
        }))
      : DEFAULT_FEATURES;

  const steps =
    howItWorksSteps.length > 0
      ? howItWorksSteps
      : [
          "Create your workspace in under two minutes",
          "Add people, cards, and your first due",
          "Set reminders and let OWE DUE nudge on schedule",
          "Export reports when you're ready to reconcile",
        ];

  const security =
    securityItems.length > 0
      ? securityItems.map((item, i) => ({
          title: item.title,
          description: item.description?.replace(/<[^>]+>/g, "") || "",
          icon: DEFAULT_SECURITY[i % DEFAULT_SECURITY.length].icon,
        }))
      : DEFAULT_SECURITY;

  return (
    <div className="landing-page relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <LandingNavbar />

      <LandingHero content={content} heroStats={heroStats} />

      <section id="features" className="landing-section relative px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <LandingSectionHeading
            eyebrow={content.featuresEyebrow || "Platform"}
            title={content.featuresTitle || "Everything you need in one workspace"}
            description="A bento-grade product surface—minimal chrome, maximum clarity for money in motion."
          />
          <div className="mt-14 grid gap-4 md:grid-cols-3 md:auto-rows-[minmax(140px,auto)]">
            {featureList.map((feature) => {
              const Icon = feature.icon || Layers;
              return (
                <SpotlightCard key={feature.title} className={cn("h-full", feature.span)}>
                  <Badge variant="emerald" className="mb-3 w-fit">
                    {feature.eyebrow}
                  </Badge>
                  <Icon className="mb-4 h-6 w-6 text-amber-500 dark:text-amber-400/90" />
                  <h3 className={landingH3}>{feature.title}</h3>
                  <p className={cn("mt-2 text-sm leading-relaxed", landingMuted)}>{feature.description}</p>
                </SpotlightCard>
              );
            })}
          </div>
        </div>
      </section>

      <Separator className={landingSeparator} />

      <section className="landing-section relative px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <LandingTrendingBlock />
        </div>
      </section>

      <section id="workflow" className="landing-section relative px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <LandingSectionHeading
                align="left"
                className="mx-0 max-w-none"
                eyebrow={content.howItWorksEyebrow || "Workflow"}
                title={content.howItWorksTitle || "From signup to control in four steps"}
                description="Onboard fast, operate daily, and reconcile monthly—without spreadsheet chaos."
              />
              <LandingWorkflowTabs />
            </div>
            <ol className="relative space-y-0">
              {steps.map((step, idx) => (
                <li key={idx} className="relative flex gap-5 pb-10 last:pb-0">
                  {idx < steps.length - 1 ? (
                    <span className="absolute left-[15px] top-10 h-[calc(100%-2rem)] w-px bg-linear-to-b from-amber-500/50 to-transparent" />
                  ) : null}
                  <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/15 text-xs font-bold text-amber-800 dark:text-amber-200">
                    {idx + 1}
                  </span>
                  <SpotlightCard className="flex-1 p-5">
                    <p className={cn("text-sm font-medium leading-relaxed", landingMutedSm)}>{step}</p>
                  </SpotlightCard>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="security" className="landing-section relative px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <LandingSectionHeading
            eyebrow={content.securityEyebrow || "Trust"}
            title={content.securityTitle || "Enterprise-grade security, startup speed"}
          />
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {security.map((item) => {
              const Icon = item.icon;
              return (
                <SpotlightCard key={item.title}>
                  <div className="mb-4 inline-flex rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                    <Icon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className={landingH3}>{item.title}</h3>
                  <p className={cn("mt-2 text-sm leading-relaxed", landingMuted)}>{item.description}</p>
                </SpotlightCard>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="landing-section relative px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <LandingSectionHeading
            eyebrow={content.plansEyebrow || "Pricing"}
            title={content.plansTitle || "Plans that scale with your hustle"}
            description={
              content.plansDescription?.replace(/<[^>]+>/g, " ") ||
              "Start free. Upgrade when you need premium exports, recurring dues, and advanced reminders."
            }
          />
          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <LandingPricingCard
              plan={{
                ...freePlan,
                features: freePlan.features || ["Unlimited people", "Core reminders", "Community access"],
                ctaLabel: freePlan.ctaLabel || "Get started free",
              }}
            />
            <LandingPricingCard
              featured
              plan={{
                ...paidPlan,
                features: paidPlan.features || [
                  "Everything in Free",
                  "Premium PDF exports",
                  "Recurring dues",
                  "Priority support",
                ],
                ctaLabel: paidPlan.ctaLabel || "Upgrade to Pro",
              }}
            />
          </div>
          {content.plansFootnote?.trim() ? (
            <p className="mt-6 text-center text-sm text-zinc-500">{content.plansFootnote.trim()}</p>
          ) : null}
        </div>
      </section>

      <section className="landing-section relative px-4 pb-8 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SpotlightCard className="overflow-hidden p-8 md:flex md:items-center md:justify-between md:p-12">
            <div className="max-w-xl">
              <Badge variant="default" className="mb-4">
                <Zap className="mr-1 h-3 w-3" />
                Ready when you are
              </Badge>
              <h2 className={cn(landingH3, "text-2xl md:text-3xl")}>
                {content.finalCtaTitle || "Join thousands tracking dues effortlessly."}
              </h2>
              <p className={cn("mt-3 text-sm md:text-base", landingMuted)}>
                Create your account in minutes. No credit card required on the free plan.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row md:mt-0">
              <Button size="lg" asChild>
                <Link href="/signup">
                  Create your account
                  <Sparkles className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </SpotlightCard>
        </div>
      </section>

      <section className="landing-section relative px-4 py-16 sm:px-6 md:py-20">
        <div className="mx-auto max-w-6xl">
          <SpotlightCard className="p-8 md:p-10">
            <div className="md:flex md:items-center md:justify-between md:gap-10">
              <div className="max-w-xl">
                <Badge variant="emerald" className="mb-4">
                  {content.communityEyebrow || "Community"}
                </Badge>
                <h2 className={cn(landingH3, "text-2xl md:text-3xl")}>
                  {content.communityTitle || "Learn from others. Share what works."}
                </h2>
                <div
                  className={cn("mt-3 text-sm leading-relaxed cms-html [&_a]:text-amber-600 dark:[&_a]:text-amber-300", landingMuted)}
                  dangerouslySetInnerHTML={{
                    __html:
                      content.communityDescription ||
                      "<p>Join discussions, discover trending topics, and see how operators stay organized.</p>",
                  }}
                />
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row md:mt-0">
                <Button asChild>
                  <Link href={content.communityCtaPrimaryHref || "/signup"}>
                    {content.communityCtaPrimaryLabel || "Get started free"}
                  </Link>
                </Button>
                <Button variant="secondary" asChild>
                  <Link href={content.communityCtaCommunityHref || "/community"}>
                    {content.communityCtaCommunityLabel || "Explore community"}
                  </Link>
                </Button>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </section>

      <PublicFooter variant="landing" />
    </div>
  );
}
