const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getCommunitySiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://myowedue.vercel.app").replace(/\/$/, "");
}

export function isLikelyCommunityPostId(id) {
  return typeof id === "string" && UUID_RE.test(id.trim());
}

/**
 * @param {string} [body]
 * @param {number} [max]
 */
export function excerptFromPostBody(body, max = 160) {
  const t = String(body ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * @param {{ body?: string; author_name?: string }} post
 * @param {number} [max]
 */
export function titleSnippetFromPost(post, max = 55) {
  const fromBody = excerptFromPostBody(post.body, max);
  if (fromBody) return fromBody;
  const name = String(post.author_name ?? "").trim();
  return name ? `Post by ${name}` : "Community post";
}

/**
 * Derive SEO title, description, and keywords from post content.
 * @param {{ body?: string; author_name?: string }} post
 */
export function deriveCommunityPostSeoFields(post) {
  const author = String(post.author_name ?? "").trim();
  const snippet = titleSnippetFromPost(post, 52);
  const description =
    excerptFromPostBody(post.body, 160) ||
    (author ? `Public community post by ${author} on OWE DUE.` : "Public community post on OWE DUE.");

  const keywords = [
    "OWE DUE community",
    "community post",
    author,
    ...lightKeywordsFromBody(post.body, 12),
  ]
    .map((k) => String(k || "").trim())
    .filter(Boolean);

  const seen = new Set();
  const seo_keywords = [];
  for (const k of keywords) {
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    seo_keywords.push(k);
    if (seo_keywords.length >= 15) break;
  }

  return {
    seo_title: snippet ? `${snippet} | OWE DUE Community` : "Community post | OWE DUE",
    seo_description: description,
    seo_keywords,
  };
}

/**
 * Metadata fields for Next.js `generateMetadata` (stored or derived).
 * @param {{ body?: string; author_name?: string; seo_title?: string | null; seo_description?: string | null; seo_keywords?: string[] | null }} post
 */
export function communityPostMetadataFromRecord(post) {
  const derived = deriveCommunityPostSeoFields(post);
  const title = String(post.seo_title || "").trim() || derived.seo_title;
  const description = String(post.seo_description || "").trim() || derived.seo_description;
  const keywords =
    Array.isArray(post.seo_keywords) && post.seo_keywords.length > 0
      ? post.seo_keywords
      : derived.seo_keywords;

  return { title, description, keywords };
}

export function lightKeywordsFromBody(body, limit = 12) {
  const words = String(body ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((w) => w.length > 3);
  const seen = new Set();
  const out = [];
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * @param {{ id: string; author_name: string; body: string; created_at: string; updated_at: string }} post
 * @param {string} canonicalUrl
 */
export function buildCommunityPostJsonLd(post, canonicalUrl) {
  const site = getCommunitySiteUrl();
  const { title: metaTitle, description: metaDescription } = communityPostMetadataFromRecord(post);
  const headline = metaTitle.replace(/\s*\|\s*OWE DUE Community$/i, "").trim() || excerptFromPostBody(post.body, 110);
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: headline || `Post by ${post.author_name}`,
    description: metaDescription,
    articleBody: post.body,
    author: {
      "@type": "Person",
      name: post.author_name,
    },
    datePublished: post.created_at,
    dateModified: post.updated_at || post.created_at,
    url: canonicalUrl,
    isPartOf: {
      "@type": "WebSite",
      name: "OWE DUE Community",
      url: `${site}/community`,
    },
    publisher: {
      "@type": "Organization",
      name: "OWE DUE",
      url: site,
    },
  };
}

/**
 * @param {Array<{ id: string; author_name: string; body: string; created_at: string }>} posts
 * @param {string} siteBase
 */
export function buildCommunityFeedJsonLd(posts, siteBase) {
  const site = String(siteBase || "").replace(/\/$/, "") || getCommunitySiteUrl();
  const list = Array.isArray(posts) ? posts : [];
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "OWE DUE Community — recent public posts",
    description: "Public discussion feed for OWE DUE members and visitors.",
    numberOfItems: list.length,
    itemListElement: list.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Article",
        name: p.seo_title?.replace(/\s*\|\s*OWE DUE Community$/i, "").trim() || titleSnippetFromPost(p, 72),
        url: `${site}/community/post/${p.id}`,
        datePublished: p.created_at,
      },
    })),
  };
}
