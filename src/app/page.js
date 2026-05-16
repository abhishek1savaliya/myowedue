import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";
import SeoJsonLd from "@/components/SeoJsonLd";
import { getCmsPageContent } from "@/lib/cmsPublic";
import { buildSiteGraphJsonLd, SITE_NAME } from "@/lib/site-seo";

const HOME_TITLE = `${SITE_NAME} | Financial Infrastructure to Track Dues & Receivables`;
const HOME_DESCRIPTION =
  "OWE DUE helps you track credits, debits, and due history in one workspace — people, transactions, reminders, reports, files, and a public community feed.";

export const metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: "/",
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

  const structuredData = buildSiteGraphJsonLd({
    includeWebPage: true,
    pageName: HOME_TITLE,
    pageDescription: HOME_DESCRIPTION,
    pagePath: "/",
  });

  return (
    <>
      <SeoJsonLd data={structuredData} />
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
