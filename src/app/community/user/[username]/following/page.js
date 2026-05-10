import CommunityConnectionsPageClient from "@/components/community/CommunityConnectionsPageClient";

export default async function CommunityFollowingPage({ params }) {
  const { username } = await params;
  return <CommunityConnectionsPageClient username={String(username || "")} mode="following" />;
}

