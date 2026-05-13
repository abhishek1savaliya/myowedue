import CommunityTrendingPageClient from "@/components/community/CommunityTrendingPageClient";

export const metadata = {
  title: "Trending — Community",
  description: "Top community topics from the last 24 hours by engagement. Open a topic to browse related posts.",
  alternates: { canonical: "/community/trending" },
};

export default function CommunityTrendingPage() {
  return <CommunityTrendingPageClient />;
}
