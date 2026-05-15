import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";
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
  const howItWorksSteps = Array.isArray(content.howItWorksSteps) ? content.howItWorksSteps : [];
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
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <LandingPage
        content={content}
        features={features}
        heroStats={heroStats}
        howItWorksSteps={howItWorksSteps}
        securityItems={securityItems}
        freePlan={{ ...freePlan, features: freePlanFeatures }}
        paidPlan={{ ...paidPlan, features: paidPlanFeatures }}
      />
    </>
  );
}
