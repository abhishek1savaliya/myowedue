import CommunityProfileClient from "@/components/community/CommunityProfileClient";
import { getCommunitySiteUrl } from "@/lib/community-seo";
import { normalizeSavedUsernameHandle, tryNormalizeCommunityUsername } from "@/lib/community-usernames";

export async function generateMetadata({ params }) {
  const { username: raw } = await params;
  const segment = normalizeSavedUsernameHandle(String(raw ?? ""));
  const site = getCommunitySiteUrl();
  const path = `/community/user/${encodeURIComponent(segment || "member")}`;

  const parsed = tryNormalizeCommunityUsername(segment);
  if (!parsed.ok) {
    return {
      title: "Profile",
      description: "Community member profile on OWE DUE.",
      alternates: { canonical: path },
    };
  }

  const title = `@${parsed.normalized} · Community`;
  const description = `View @${parsed.normalized} on OWE DUE Community.`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "OWE DUE",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function CommunityUserProfilePage({ params }) {
  const { username } = await params;
  const segment = String(username ?? "").trim();
  return <CommunityProfileClient username={segment} />;
}
