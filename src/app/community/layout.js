import CommunityPublicShell from "@/components/community/CommunityPublicShell";

export const metadata = {
  alternates: {
    types: {
      "application/rss+xml": [{ url: "/community/posts.xml", title: "OWE DUE Community posts" }],
    },
  },
};

/**
 * Keeps the public community chrome mounted when moving between the feed and a post
 * so Trending, Settings, and auth state are not torn down and refetched on every navigation.
 */
export default function CommunityLayout({ children }) {
  return <CommunityPublicShell>{children}</CommunityPublicShell>;
}
