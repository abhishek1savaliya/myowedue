import { Suspense } from "react";
import CommunityFeedClient from "@/components/community/CommunityFeedClient";
import {
  buildCommunityFeedJsonLd,
  excerptFromPostBody,
  getCommunitySiteUrl,
  lightKeywordsFromBody,
} from "@/lib/community-seo";
import { fetchCommunityFeedForSeo } from "@/lib/community-seo-server";

/** ISR: refresh server HTML / meta / JSON-LD periodically for search engines. */
export const revalidate = 60;

const FEED_SEO_LIMIT = 24;
const META_SNIPPET_POSTS = 4;

export async function generateMetadata() {
  const site = getCommunitySiteUrl();
  const { posts } = await fetchCommunityFeedForSeo(META_SNIPPET_POSTS);
  const baseDesc =
    "Browse public posts on OWE DUE Community: likes, threaded replies, and shares. Sign in to post and comment.";
  let description = baseDesc;
  if (posts.length > 0) {
    const snippets = posts
      .slice(0, 3)
      .map((p) => excerptFromPostBody(p.body, 100))
      .filter(Boolean);
    const joined = snippets.join(" · ");
    if (joined) {
      description = excerptFromPostBody(`${joined}`, 158);
    }
  }

  const kw = new Set([
    "OWE DUE community",
    "public posts",
    "credit tracker community",
    "personal finance discussion",
  ]);
  for (const p of posts.slice(0, 2)) {
    for (const w of lightKeywordsFromBody(p.body, 8)) {
      kw.add(w);
    }
  }

  return {
    title: "Community — posts & conversations",
    description,
    keywords: Array.from(kw),
    alternates: {
      canonical: "/community",
    },
    openGraph: {
      title: "OWE DUE Community",
      description,
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

export default async function CommunityPublicPage() {
  const site = getCommunitySiteUrl();
  const { posts } = await fetchCommunityFeedForSeo(FEED_SEO_LIMIT);
  const jsonLd = posts.length > 0 ? buildCommunityFeedJsonLd(posts, site) : null;

  const initialForClient = posts.map((p) => ({
    ...p,
    share_count: p.share_count ?? 0,
    likeCount: 0,
    commentCount: 0,
    liked: false,
    authorVerified: false,
  }));

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <noscript>
        <main className="mx-auto max-w-2xl bg-white px-4 py-8 text-zinc-900">
          <h1 className="text-2xl font-bold tracking-tight">OWE DUE Community</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Recent public posts. Enable JavaScript for the full feed, likes, and comments — or open each thread
            below.
          </p>
          {posts.length === 0 ? (
            <p className="mt-8 text-zinc-700">No posts yet.</p>
          ) : (
            <ol className="mt-8 list-decimal space-y-6 pl-5 marker:font-semibold">
              {posts.map((p) => (
                <li key={p.id}>
                  <article itemScope itemType="https://schema.org/SocialMediaPosting">
                    <p className="font-semibold text-zinc-900" itemProp="author">
                      {p.author_name}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800" itemProp="articleBody">
                      {p.body}
                    </p>
                    <p className="mt-3">
                      <a className="text-sm font-semibold text-amber-800 underline" href={`/community/post/${p.id}`}>
                        Open thread (replies and likes)
                      </a>
                    </p>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </main>
      </noscript>
      <Suspense
        fallback={
          <div className="mx-auto flex min-h-[40vh] w-full max-w-xl flex-col items-center justify-center gap-2 px-4 py-12 text-zinc-600 dark:text-zinc-400">
            <span className="text-sm">Loading community…</span>
          </div>
        }
      >
        <CommunityFeedClient
          variant="public"
          skin="default"
          shareBasePath="/community"
          loginNextPath="/community"
          initialFeedPosts={initialForClient}
        />
      </Suspense>
    </>
  );
}
