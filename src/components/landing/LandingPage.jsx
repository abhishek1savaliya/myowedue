"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  Calendar,
  Check,
  FileText,
  Fingerprint,
  Layers,
  Lock,
  MessageCircle,
  Receipt,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import HomeTrendingSection from "@/components/HomeTrendingSection";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingHero from "@/components/landing/LandingHero";
import SpotlightCard from "@/components/landing/SpotlightCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const DEFAULT_FEATURES = [
  {
    eyebrow: "Ledger",
    title: "Credits & debits in one timeline",
    description: "Every handshake, invoice, and IOU—organized with running balances and smart filters.",
    icon: Receipt,
    span: "md:col-span-2 md:row-span-2",
  },
  {
    eyebrow: "Reminders",
    title: "Never miss a due date",
    description: "Email and in-app nudges tuned to your rhythm.",
    icon: Bell,
    span: "",
  },
  {
    eyebrow: "People",
    title: "Contacts that stay in sync",
    description: "Link dues to real people with full history.",
    icon: MessageCircle,
    span: "",
  },
  {
    eyebrow: "Files",
    title: "Receipts & agreements",
    description: "Attach proof to any transaction.",
    icon: FileText,
    span: "md:col-span-2",
  },
  {
    eyebrow: "Events",
    title: "Calendar-aware cash flow",
    description: "See what's coming before it hits.",
    icon: Calendar,
    span: "",
  },
  {
    eyebrow: "Reports",
    title: "Export-ready insights",
    description: "PDF summaries built for accountants and clients.",
    icon: TrendingUp,
    span: "",
  },
];

const DEFAULT_SECURITY = [
  {
    title: "Encryption by default",
    description: "Sensitive fields protected in transit and at rest with industry-standard cryptography.",
    icon: Lock,
  },
  {
    title: "Session integrity",
    description: "Secure cookies, rotation, and device-aware login activity controls.",
    icon: Fingerprint,
  },
  {
    title: "Your data, your rules",
    description: "Export, audit, and delete on your terms—no dark patterns.",
    icon: Shield,
  },
];

function SectionHeading({ eyebrow, title, description, className, align = "center" }) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className
      )}
    >
      <Badge variant="secondary" className="mb-4">
        {eyebrow}
      </Badge>
      <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-zinc-400 md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}

function PricingCard({ plan, featured = false }) {
  const features = Array.isArray(plan.features) ? plan.features : [];
  return (
    <SpotlightCard
      className={cn(
        "flex h-full flex-col p-7 md:p-8",
        featured && "border-amber-500/30 ring-1 ring-amber-500/20"
      )}
      delay={featured ? 0.1 : 0}
    >
      {featured ? (
        <Badge className="mb-4 w-fit">Most popular</Badge>
      ) : (
        <Badge variant="secondary" className="mb-4 w-fit">
          {plan.badge || "Plan"}
        </Badge>
      )}
      <h3 className="text-2xl font-semibold text-white">{plan.name || "Plan"}</h3>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-4xl font-bold text-white">{plan.price || "$0"}</span>
        <span className="pb-1 text-sm text-zinc-500">{plan.billing || ""}</span>
      </div>
      <div
        className="mt-4 text-sm leading-relaxed text-zinc-400 cms-html"
        dangerouslySetInnerHTML={{ __html: plan.description || "" }}
      />
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2.5 text-sm text-zinc-300">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            {item}
          </li>
        ))}
      </ul>
      <Button
        className="mt-8 w-full"
        variant={featured ? "default" : "secondary"}
        asChild
      >
        <Link href={plan.ctaHref || "/signup"}>
          {plan.ctaLabel || "Get started"}
          {featured ? <ArrowRight className="h-4 w-4" /> : null}
        </Link>
      </Button>
    </SpotlightCard>
  );
}

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
    <div className="landing-page relative min-h-screen overflow-x-hidden bg-[#030712] text-zinc-100">
      <div className="landing-blob landing-blob-a pointer-events-none absolute -left-32 top-20 h-[420px] w-[420px] rounded-full opacity-60" aria-hidden />
      <div className="landing-blob landing-blob-b pointer-events-none absolute -right-24 top-[40%] h-[380px] w-[380px] rounded-full opacity-50" aria-hidden />
      <div className="landing-blob landing-blob-c pointer-events-none absolute bottom-0 left-1/3 h-[320px] w-[320px] rounded-full opacity-40" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(245,158,11,0.15),transparent)]" aria-hidden />

      <LandingNavbar />

      <LandingHero content={content} heroStats={heroStats} />

      <section id="features" className="relative px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow={content.featuresEyebrow || "Platform"}
            title={content.featuresTitle || "Everything you need in one workspace"}
            description="A bento-grade product surface—minimal chrome, maximum clarity for money in motion."
          />
          <div className="mt-14 grid gap-4 md:grid-cols-3 md:auto-rows-[minmax(140px,auto)]">
            {featureList.map((feature, idx) => {
              const Icon = feature.icon || Layers;
              return (
                <SpotlightCard key={feature.title} className={cn("h-full", feature.span)} delay={idx * 0.06}>
                  <Badge variant="emerald" className="mb-3 w-fit">
                    {feature.eyebrow}
                  </Badge>
                  <Icon className="mb-4 h-6 w-6 text-amber-400/90" />
                  <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{feature.description}</p>
                </SpotlightCard>
              );
            })}
          </div>
        </div>
      </section>

      <Separator className="mx-auto max-w-6xl bg-white/10" />

      <section className="relative px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="landing-trending-wrap rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-xl md:p-8">
            <HomeTrendingSection variant="landing" />
          </div>
        </div>
      </section>

      <section id="workflow" className="relative px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionHeading
                align="left"
                className="mx-0 max-w-none"
                eyebrow={content.howItWorksEyebrow || "Workflow"}
                title={content.howItWorksTitle || "From signup to control in four steps"}
                description="Onboard fast, operate daily, and reconcile monthly—without spreadsheet chaos."
              />
              <Tabs defaultValue="track" className="mt-10 hidden md:block">
                <TabsList>
                  <TabsTrigger value="track">Track</TabsTrigger>
                  <TabsTrigger value="remind">Remind</TabsTrigger>
                  <TabsTrigger value="report">Report</TabsTrigger>
                </TabsList>
                <TabsContent value="track">
                  <p className="text-sm text-zinc-400">Unified ledger for every credit and debit you manage.</p>
                </TabsContent>
                <TabsContent value="remind">
                  <p className="text-sm text-zinc-400">Smart schedules that respect timezone and tone.</p>
                </TabsContent>
                <TabsContent value="report">
                  <p className="text-sm text-zinc-400">Investor-ready exports in one click.</p>
                </TabsContent>
              </Tabs>
            </div>
            <ol className="relative space-y-0">
              {steps.map((step, idx) => (
                <li key={idx} className="relative flex gap-5 pb-10 last:pb-0">
                  {idx < steps.length - 1 ? (
                    <span className="absolute left-[15px] top-10 h-[calc(100%-2rem)] w-px bg-gradient-to-b from-amber-500/50 to-transparent" />
                  ) : null}
                  <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-xs font-bold text-amber-200">
                    {idx + 1}
                  </span>
                  <SpotlightCard className="flex-1 p-5" delay={idx * 0.08}>
                    <p className="text-sm font-medium leading-relaxed text-zinc-200">{step}</p>
                  </SpotlightCard>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="security" className="relative px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow={content.securityEyebrow || "Trust"}
            title={content.securityTitle || "Enterprise-grade security, startup speed"}
          />
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {security.map((item, idx) => {
              const Icon = item.icon || Shield;
              return (
                <SpotlightCard key={item.title} delay={idx * 0.08}>
                  <div className="mb-4 inline-flex rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                    <Icon className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.description}</p>
                </SpotlightCard>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="relative px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow={content.plansEyebrow || "Pricing"}
            title={content.plansTitle || "Plans that scale with your hustle"}
            description={
              content.plansDescription?.replace(/<[^>]+>/g, " ") ||
              "Start free. Upgrade when you need premium exports, recurring dues, and advanced reminders."
            }
          />
          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <PricingCard
              plan={{
                ...freePlan,
                features: freePlan.features || ["Unlimited people", "Core reminders", "Community access"],
                ctaLabel: freePlan.ctaLabel || "Get started free",
              }}
            />
            <PricingCard
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

      <section className="relative px-4 pb-8 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SpotlightCard className="overflow-hidden p-8 md:flex md:items-center md:justify-between md:p-12">
            <div className="max-w-xl">
              <Badge variant="default" className="mb-4">
                <Zap className="mr-1 h-3 w-3" />
                Ready when you are
              </Badge>
              <h2 className="text-2xl font-semibold text-white md:text-3xl">
                {content.finalCtaTitle || "Join thousands tracking dues effortlessly."}
              </h2>
              <p className="mt-3 text-sm text-zinc-400 md:text-base">
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

      <section className="relative px-4 py-16 sm:px-6 md:py-20">
        <div className="mx-auto max-w-6xl">
          <SpotlightCard className="p-8 md:p-10">
            <div className="md:flex md:items-center md:justify-between md:gap-10">
              <div className="max-w-xl">
                <Badge variant="emerald" className="mb-4">
                  {content.communityEyebrow || "Community"}
                </Badge>
                <h2 className="text-2xl font-semibold text-white md:text-3xl">
                  {content.communityTitle || "Learn from others. Share what works."}
                </h2>
                <div
                  className="mt-3 text-sm leading-relaxed text-zinc-400 cms-html [&_a]:text-amber-300"
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

      <PublicFooter />
    </div>
  );
}
