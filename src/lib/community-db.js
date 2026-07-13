import { getCommunityPool } from "@/lib/community-postgres";
import { getSupabaseDatabaseUrl } from "@/lib/supabase-env";
import { COMMUNITY_POST_LIST_SELECT } from "@/lib/community-post-edit-window";

const POST_COLUMNS = COMMUNITY_POST_LIST_SELECT.split(", ").map((c) => c.trim());

export function isCommunityDbConfigured() {
  return Boolean(getSupabaseDatabaseUrl());
}

async function db() {
  const pool = getCommunityPool();
  if (!pool) throw new Error("Community database not configured");
  return pool;
}

function postSelectSql(alias = "p") {
  return POST_COLUMNS.map((c) => `${alias}."${c}"`).join(", ");
}

/** @param {string[]} postIds */
export async function fetchPostLikesForPosts(postIds) {
  const ids = [...new Set((postIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT post_id, user_id FROM public.community_post_likes WHERE post_id = ANY($1::uuid[])`,
    [ids]
  );
  return rows;
}

/** @param {string[]} postIds */
export async function fetchCommentCountsForPosts(postIds) {
  const ids = [...new Set((postIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT post_id FROM public.community_comments WHERE post_id = ANY($1::uuid[])`,
    [ids]
  );
  return rows;
}

export async function findPostLike(postId, userId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT post_id FROM public.community_post_likes WHERE post_id = $1 AND user_id = $2 LIMIT 1`,
    [postId, userId]
  );
  return rows[0] || null;
}

export async function insertPostLike(postId, userId) {
  const pool = await db();
  await pool.query(
    `INSERT INTO public.community_post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [postId, userId]
  );
}

export async function deletePostLike(postId, userId) {
  const pool = await db();
  await pool.query(
    `DELETE FROM public.community_post_likes WHERE post_id = $1 AND user_id = $2`,
    [postId, userId]
  );
}

export async function fetchPostLikesByUser(userId, { limit = 11, cursor = null } = {}) {
  const pool = await db();
  const params = [userId, limit];
  let sql = `
    SELECT post_id, created_at
    FROM public.community_post_likes
    WHERE user_id = $1
  `;
  if (cursor) {
    params.push(cursor);
    sql += ` AND created_at < $3`;
  }
  sql += ` ORDER BY created_at DESC LIMIT $2`;
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function fetchPostAuthorBody(postId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT author_id, body FROM public.community_posts WHERE id = $1 LIMIT 1`,
    [postId]
  );
  return rows[0] || null;
}

export async function insertFeedSignalLike(userId, postId) {
  const pool = await db();
  await pool.query(
    `INSERT INTO public.community_feed_signals (user_id, post_id, event_type, watch_time_ms, scroll_duration_ms, dwell_ms)
     VALUES ($1, $2, 'like', 0, 0, 0)`,
    [userId, postId]
  ).catch(() => {});
}

export async function fetchPostsByIds(postIds) {
  const ids = [...new Set((postIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT ${postSelectSql()} FROM public.community_posts p WHERE p.id = ANY($1::uuid[])`,
    [ids]
  );
  return rows;
}

export async function fetchPostById(postId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT ${postSelectSql()} FROM public.community_posts p WHERE p.id = $1 LIMIT 1`,
    [postId]
  );
  return rows[0] || null;
}

export async function listPosts({ limit = 11, cursor = null, authorId = null, offset = 0 } = {}) {
  const pool = await db();
  const params = [limit];
  let sql = `SELECT ${postSelectSql()} FROM public.community_posts p WHERE 1=1`;
  if (authorId) {
    params.push(authorId);
    sql += ` AND p.author_id = $${params.length}`;
  }
  if (cursor) {
    params.push(cursor);
    sql += ` AND p.created_at < $${params.length}`;
  }
  sql += ` ORDER BY p.created_at DESC LIMIT $1`;
  if (offset > 0) {
    params.push(offset);
    sql += ` OFFSET $${params.length}`;
  }
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function fetchLikedPostIdsByUser(userId, limit = 200) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT post_id FROM public.community_post_likes WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

export async function findCommentById(commentId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT id, post_id, author_id, body FROM public.community_comments WHERE id = $1 LIMIT 1`,
    [commentId]
  );
  return rows[0] || null;
}

export async function findCommentLike(commentId, userId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT comment_id FROM public.community_comment_likes WHERE comment_id = $1 AND user_id = $2 LIMIT 1`,
    [commentId, userId]
  );
  return rows[0] || null;
}

export async function insertCommentLike(commentId, userId) {
  const pool = await db();
  await pool.query(
    `INSERT INTO public.community_comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [commentId, userId]
  );
}

export async function deleteCommentLike(commentId, userId) {
  const pool = await db();
  await pool.query(
    `DELETE FROM public.community_comment_likes WHERE comment_id = $1 AND user_id = $2`,
    [commentId, userId]
  );
}

export async function countCommentLikes(commentId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM public.community_comment_likes WHERE comment_id = $1`,
    [commentId]
  );
  return rows[0]?.n ?? 0;
}
