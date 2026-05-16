import CommunitySinglePostClient from "@/components/community/CommunitySinglePostClient";
import SeoJsonLd from "@/components/SeoJsonLd";
import {
  buildCommunityPostJsonLd,
  communityPostMetadataFromRecord,
  excerptFromPostBody,
  fetchCommunityPostForSeo,
  getCommunitySiteUrl,
  isLikelyCommunityPostId,
} from "@/lib/community-seo";

/** ISR: refresh post HTML / metadata for search engines after publish or edit. */
export const revalidate = 60;

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

  const { title, description, keywords } = communityPostMetadataFromRecord(post);

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
  const { title: metaTitle } = post ? communityPostMetadataFromRecord(post) : null;

  return (
    <>
      {jsonLd ? <SeoJsonLd data={jsonLd} /> : null}
      {post ? (
        <noscript>
          <article
            className="mx-auto max-w-xl px-4 py-6 text-zinc-900 dark:text-zinc-100"
            itemScope
            itemType="https://schema.org/DiscussionForumPosting"
          >
            <h1 className="text-xl font-bold tracking-tight" itemProp="headline">
              {metaTitle?.replace(/\s*\|\s*OWE DUE Community$/i, "").trim() ||
                excerptFromPostBody(post.body, 80)}
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400" itemProp="author">
              {post.author_name}
            </p>
            <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed" itemProp="articleBody">
              {post.body}
            </p>
            <p className="mt-4 text-sm">
              <a href={canonicalUrl} className="font-semibold text-amber-700 underline dark:text-amber-300">
                Open full thread with replies
              </a>
            </p>
          </article>
        </noscript>
      ) : null}
      <CommunitySinglePostClient
        postId={rawId}
        loginNextPath="/community"
        backHref="/community"
        skin="default"
        initialPost={post}
      />
    </>
  );
}
