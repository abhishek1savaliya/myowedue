import CommunityFeedClient from "@/components/community/CommunityFeedClient";

export const metadata = {
  title: "Community — posts & conversations",
  description:
    "Browse public posts on OWE DUE Community: likes, threaded replies, and shares. Sign in to post and comment.",
  keywords: [
    "OWE DUE community",
    "public posts",
    "credit tracker community",
    "personal finance discussion",
  ],
  alternates: {
    canonical: "/community",
  },
  openGraph: {
    title: "OWE DUE Community",
    description:
      "Public posts, likes, comments, and shares — join the conversation when you sign in.",
    url: "/community",
    type: "website",
    siteName: "OWE DUE",
    images: [
      {
        url: "/owedue-logo.svg",
        width: 160,
        height: 160,
        alt: "OWE DUE logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "OWE DUE Community",
    description: "Public posts and replies — sign in to participate.",
    images: ["/owedue-logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function CommunityPublicPage() {
  return (
    <CommunityFeedClient variant="public" skin="x" shareBasePath="/community" loginNextPath="/community" />
  );
}
