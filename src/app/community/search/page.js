import CommunitySearchPageClient from "@/components/community/CommunitySearchPageClient";

export const metadata = {
  title: "Search members",
  description: "Find community members by @username.",
  alternates: { canonical: "/community/search" },
  robots: { index: false, follow: true },
};

export default function CommunitySearchPage() {
  return <CommunitySearchPageClient />;
}
