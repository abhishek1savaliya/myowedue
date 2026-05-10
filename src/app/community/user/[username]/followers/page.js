import CommunityConnectionsPageClient from "@/components/community/CommunityConnectionsPageClient";

export default async function CommunityFollowersPage({ params }) {
  const { username } = await params;
  return <CommunityConnectionsPageClient username={String(username || "")} mode="followers" />;
}

