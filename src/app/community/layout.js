import CommunityPublicShell from "@/components/community/CommunityPublicShell";

/**
 * Keeps the public community chrome mounted when moving between the feed and a post
 * so Trending, Settings, and auth state are not torn down and refetched on every navigation.
 */
export default function CommunityLayout({ children }) {
  return <CommunityPublicShell>{children}</CommunityPublicShell>;
}
