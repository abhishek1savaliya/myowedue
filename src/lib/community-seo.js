import { cache } from "react";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";

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
 * @param {string} [body]
 * @param {number} [limit]
 */
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
 * @param {string} postId
 * @returns {Promise<null | { id: string; author_id: string; author_name: string; body: string; created_at: string; updated_at: string }>}
 */
export const fetchCommunityPostForSeo = cache(async (postId) => {
  if (!isLikelyCommunityPostId(postId)) return null;
  if (!isSupabaseCommunityConfigured()) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("community_posts")
    .select("id, author_id, author_name, body, created_at, updated_at")
    .eq("id", postId.trim())
    .maybeSingle();
  if (error || !data) return null;
  return data;
});

/**
 * @returns {Promise<Array<{ id: string; updated_at: string }>>}
 */
export async function fetchCommunityPostSitemapRows(limit = 5000) {
  if (!isSupabaseCommunityConfigured()) return [];
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("community_posts")
    .select("id, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return data;
}

/**
 * @param {{ id: string; author_name: string; body: string; created_at: string; updated_at: string }} post
 * @param {string} canonicalUrl
 */
export function buildCommunityPostJsonLd(post, canonicalUrl) {
  const site = getCommunitySiteUrl();
  const headline = excerptFromPostBody(post.body, 110);
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: headline || `Post by ${post.author_name}`,
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
