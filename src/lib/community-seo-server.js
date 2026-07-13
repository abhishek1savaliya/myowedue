import "server-only";

import { cache } from "react";
import {
  fetchPostByIdFull,
  listPostSitemapRows,
  listPostsForSeo,
} from "@/lib/community-db";
import { isCommunityConfigured } from "@/lib/community-server";
import { isLikelyCommunityPostId } from "@/lib/community-seo";

/**
 * @param {string} postId
 */
export const fetchCommunityPostForSeo = cache(async (postId) => {
  if (!isLikelyCommunityPostId(postId)) return null;
  if (!isCommunityConfigured()) return null;
  try {
    return (await fetchPostByIdFull(postId.trim())) || null;
  } catch {
    return null;
  }
});

/**
 * @param {number} [limit]
 */
export const fetchCommunityFeedForSeo = cache(async (limit = 24) => {
  const n = Math.min(Math.max(Number(limit) || 24, 1), 50);
  if (!isCommunityConfigured()) return { posts: [] };
  try {
    const posts = await listPostsForSeo(n);
    return { posts: Array.isArray(posts) ? posts : [] };
  } catch {
    return { posts: [] };
  }
});

/**
 * @param {number} [limit]
 */
export async function fetchCommunityPostSitemapRows(limit = 5000) {
  if (!isCommunityConfigured()) return [];
  try {
    const rows = await listPostSitemapRows(limit);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}
