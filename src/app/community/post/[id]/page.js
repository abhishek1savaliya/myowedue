import CommunitySinglePostClient from "@/components/community/CommunitySinglePostClient";
import {
  buildCommunityPostJsonLd,
  excerptFromPostBody,
  fetchCommunityPostForSeo,
  getCommunitySiteUrl,
  isLikelyCommunityPostId,
  lightKeywordsFromBody,
  titleSnippetFromPost,
} from "@/lib/community-seo";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const rawId = typeof id === "string" ? id : "";
  const site = getCommunitySiteUrl();
  const path = `/community/post/${rawId}`;
  const absoluteUrl = `${site}${path}`;

  if (!isLikelyCommunityPostId(rawId)) {
    return {
      title: "Post",
      description: "View a community post and replies.",
      robots: { index: false, follow: true },
      alternates: { canonical: path },
    };
  }

  const post = await fetchCommunityPostForSeo(rawId);
  if (!post) {
    return {
      title: "Post not found",
      description: "This community post is missing or was removed.",
      robots: { index: false, follow: true },
      alternates: { canonical: path },
    };
  }

  const title = `${titleSnippetFromPost(post, 52)} | Community`;
  const description = excerptFromPostBody(post.body, 160);
  const keywords = [
    "OWE DUE community",
    ...lightKeywordsFromBody(post.body, 10),
  ];

  return {
    title,
    description,
    keywords,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: absoluteUrl,
      type: "article",
      siteName: "OWE DUE",
      publishedTime: post.created_at,
      modifiedTime: post.updated_at || post.created_at,
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
      title,
      description,
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
}

export default async function CommunityPostPage({ params }) {
  const { id } = await params;
  const rawId = typeof id === "string" ? id : "";
  const site = getCommunitySiteUrl();
  const path = `/community/post/${rawId}`;
  const canonicalUrl = `${site}${path}`;
  const post =
    isLikelyCommunityPostId(rawId) ? await fetchCommunityPostForSeo(rawId) : null;
  const jsonLd = post ? buildCommunityPostJsonLd(post, canonicalUrl) : null;

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <CommunitySinglePostClient
        postId={rawId}
        loginNextPath="/community"
        backHref="/community"
        skin="default"
      />
    </>
  );
}
