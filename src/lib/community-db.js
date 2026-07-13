import "server-only";

import { getCommunityPool } from "@/lib/community-postgres";
import { getCommunityDatabaseUrl } from "@/lib/community-env";
import { COMMUNITY_POST_LIST_SELECT } from "@/lib/community-post-edit-window";

const POST_COLUMNS = COMMUNITY_POST_LIST_SELECT.split(", ").map((c) => c.trim());
const COMMENT_SELECT =
  "id, post_id, parent_id, author_id, author_name, body, created_at";

export function isCommunityDbConfigured() {
  return Boolean(getCommunityDatabaseUrl());
}

async function db() {
  const pool = getCommunityPool();
  if (!pool) throw new Error("Community database not configured");
  return pool;
}

function postSelectSql(alias = "p") {
  return POST_COLUMNS.map((c) => `${alias}."${c}"`).join(", ");
}

// ——— Usernames ———

export async function fetchAllUsernames() {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT user_id, username FROM public.community_usernames ORDER BY username ASC`
  );
  return rows;
}

/** @param {string[]} userIds */
export async function fetchUsernameMapByUserIds(userIds) {
  const uniq = [...new Set((userIds || []).map((id) => String(id).trim()).filter(Boolean))];
  if (!uniq.length) return new Map();
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT user_id, username FROM public.community_usernames WHERE user_id = ANY($1::text[])`,
    [uniq]
  );
  const m = new Map();
  for (const row of rows) m.set(String(row.user_id), String(row.username));
  return m;
}

export async function findUsernameByUserId(userId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT user_id, username FROM public.community_usernames WHERE user_id = $1 LIMIT 1`,
    [String(userId)]
  );
  return rows[0] || null;
}

export async function findUsernameByHandle(username, { ilike = false } = {}) {
  const pool = await db();
  const sql = ilike
    ? `SELECT user_id, username FROM public.community_usernames WHERE username ILIKE $1 LIMIT 1`
    : `SELECT user_id, username FROM public.community_usernames WHERE username = $1 LIMIT 1`;
  const { rows } = await pool.query(sql, [username]);
  return rows[0] || null;
}

export async function upsertUsername(userId, username) {
  const pool = await db();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO public.community_usernames (user_id, username, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username, updated_at = EXCLUDED.updated_at`,
    [String(userId), username, now]
  );
}

export async function insertUsername(userId, username) {
  const pool = await db();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO public.community_usernames (user_id, username, updated_at) VALUES ($1, $2, $3)`,
    [String(userId), username, now]
  );
}

export async function suggestUsernames(prefix, lim = 10) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT username FROM public.community_username_suggest($1, $2)`,
    [prefix, lim]
  );
  return rows;
}

export async function listAllUsernamesForReindex() {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT user_id, username FROM public.community_usernames ORDER BY username ASC`
  );
  return rows;
}

// ——— Posts ———

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

export async function fetchLikedPostIdsByUser(userId, limit = 200) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT post_id FROM public.community_post_likes WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
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

export async function fetchPostShareMeta(postId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT share_count, author_id, body FROM public.community_posts WHERE id = $1 LIMIT 1`,
    [postId]
  );
  return rows[0] || null;
}

export async function incrementShareCount(postId) {
  const pool = await db();
  const { rows } = await pool.query(
    `UPDATE public.community_posts SET share_count = share_count + 1 WHERE id = $1 RETURNING share_count`,
    [postId]
  );
  return rows[0]?.share_count ?? 0;
}

export async function insertFeedSignalLike(userId, postId) {
  return insertFeedSignal({ user_id: userId, post_id: postId, event_type: "like" });
}

export async function insertFeedSignal({
  user_id,
  post_id,
  event_type,
  watch_time_ms = 0,
  scroll_duration_ms = 0,
  dwell_ms = 0,
}) {
  const pool = await db();
  await pool.query(
    `INSERT INTO public.community_feed_signals (user_id, post_id, event_type, watch_time_ms, scroll_duration_ms, dwell_ms)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [user_id, post_id, event_type, watch_time_ms, scroll_duration_ms, dwell_ms]
  ).catch(() => {});
}

export async function fetchFeedSignalsByUser(userId, sinceIso, limit = 400) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT post_id, event_type, watch_time_ms, scroll_duration_ms, dwell_ms
     FROM public.community_feed_signals
     WHERE user_id = $1 AND created_at >= $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, sinceIso, limit]
  );
  return rows;
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

export async function fetchPostByIdFull(postId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT id, author_id, author_name, body, share_count, created_at, updated_at,
            seo_title, seo_description, seo_keywords
     FROM public.community_posts WHERE id = $1 LIMIT 1`,
    [postId]
  );
  return rows[0] || null;
}

export async function listPostsSince(sinceIso, { limit = 500 } = {}) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT ${postSelectSql()} FROM public.community_posts p
     WHERE p.created_at >= $1
     ORDER BY p.created_at DESC
     LIMIT $2`,
    [sinceIso, limit]
  );
  return rows;
}

export async function listPostsForTrending(sinceIso, limit = 500) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT id, share_count, created_at FROM public.community_posts
     WHERE created_at >= $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [sinceIso, limit]
  );
  return rows;
}

export async function listRecentPostsForAnalytics(limit = 40) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT id, author_name, body, share_count, created_at
     FROM public.community_posts
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function countPostsSince(sinceIso) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM public.community_posts WHERE created_at >= $1`,
    [sinceIso]
  );
  return rows[0]?.n ?? 0;
}

export async function countPostsBetween(startIso, endIso) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM public.community_posts
     WHERE created_at >= $1 AND created_at < $2`,
    [startIso, endIso]
  );
  return rows[0]?.n ?? 0;
}

export async function fetchFollowsByFollowingIds(followingIds) {
  const ids = [...new Set((followingIds || []).map((id) => String(id).trim()).filter(Boolean))];
  if (!ids.length) return [];
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT following_id FROM public.community_follows WHERE following_id = ANY($1::text[])`,
    [ids]
  );
  return rows;
}

export async function fetchFollowingAmong(followerId, followingIds) {
  const ids = [...new Set((followingIds || []).map((id) => String(id).trim()).filter(Boolean))];
  if (!ids.length) return [];
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT following_id FROM public.community_follows
     WHERE follower_id = $1 AND following_id = ANY($2::text[])`,
    [followerId, ids]
  );
  return rows;
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

export async function listPostsByTopic(topic, { limit = 11, cursor = null } = {}) {
  const pool = await db();
  const params = [topic, limit];
  let sql = `
    SELECT ${postSelectSql()}
    FROM public.community_posts p
    INNER JOIN public.post_topics pt ON pt.post_id = p.id
    WHERE pt.topic = $1
  `;
  if (cursor) {
    params.push(cursor);
    sql += ` AND p.created_at < $${params.length}`;
  }
  sql += ` ORDER BY p.created_at DESC LIMIT $2`;
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function createPost({ author_id, author_name, body }) {
  const pool = await db();
  const { rows } = await pool.query(
    `INSERT INTO public.community_posts (author_id, author_name, body)
     VALUES ($1, $2, $3)
     RETURNING ${POST_COLUMNS.map((c) => `"${c}"`).join(", ")}`,
    [author_id, author_name, body]
  );
  return rows[0];
}

export async function updatePostBody(postId, body) {
  const pool = await db();
  const now = new Date().toISOString();
  const { rows } = await pool.query(
    `UPDATE public.community_posts SET body = $2, updated_at = $3 WHERE id = $1
     RETURNING id, author_id, created_at`,
    [postId, body, now]
  );
  return rows[0] || null;
}

export async function deletePost(postId) {
  const pool = await db();
  await pool.query(`DELETE FROM public.community_posts WHERE id = $1`, [postId]);
}

export async function listPostsForReindex({ afterId = "", limit = 120 } = {}) {
  const pool = await db();
  const params = [limit];
  let sql = `SELECT id, body FROM public.community_posts`;
  if (afterId) {
    params.push(afterId);
    sql += ` WHERE id > $2`;
  }
  sql += ` ORDER BY id ASC LIMIT $1`;
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function listPostsForSeo(limit = 24) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT id, author_id, author_name, body, created_at, updated_at, share_count,
            seo_title, seo_description, seo_keywords
     FROM public.community_posts
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function listPostSitemapRows(limit = 5000) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT id, updated_at FROM public.community_posts ORDER BY updated_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function listPostsMissingSeo(limit = 30) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT id, author_name, body, seo_title
     FROM public.community_posts
     WHERE seo_title IS NULL
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function hasSeoColumns() {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'community_posts' AND column_name = 'seo_title'
     LIMIT 1`
  );
  return rows.length > 0;
}

export async function updatePostSeo(postId, { seo_title, seo_description, seo_keywords }) {
  const pool = await db();
  await pool.query(
    `UPDATE public.community_posts
     SET seo_title = $2, seo_description = $3, seo_keywords = $4
     WHERE id = $1`,
    [postId, seo_title, seo_description, seo_keywords]
  );
}

export async function updatePostSeoWithoutKeywords(postId, { seo_title, seo_description }) {
  const pool = await db();
  await pool.query(
    `UPDATE public.community_posts SET seo_title = $2, seo_description = $3 WHERE id = $1`,
    [postId, seo_title, seo_description]
  );
}

// ——— Topics ———

export async function deletePostTopics(postId) {
  const pool = await db();
  await pool.query(`DELETE FROM public.post_topics WHERE post_id = $1`, [postId]);
}

export async function insertPostTopics(rows) {
  if (!rows?.length) return;
  const pool = await db();
  const values = [];
  const params = [];
  let i = 1;
  for (const row of rows) {
    values.push(`($${i}, $${i + 1})`);
    params.push(row.post_id, row.topic);
    i += 2;
  }
  await pool.query(
    `INSERT INTO public.post_topics (post_id, topic) VALUES ${values.join(", ")}`,
    params
  );
}

export async function fetchTopicsForPosts(postIds) {
  const ids = [...new Set((postIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT post_id, topic FROM public.post_topics WHERE post_id = ANY($1::uuid[])`,
    [ids]
  );
  return rows;
}

// ——— Comments ———

export async function findCommentById(commentId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT id, post_id, author_id, body FROM public.community_comments WHERE id = $1 LIMIT 1`,
    [commentId]
  );
  return rows[0] || null;
}

export async function findCommentWithPost(commentId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT id, post_id, author_id FROM public.community_comments WHERE id = $1 LIMIT 1`,
    [commentId]
  );
  return rows[0] || null;
}

export async function fetchAllCommentsForPost(postId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT ${COMMENT_SELECT} FROM public.community_comments WHERE post_id = $1 ORDER BY created_at ASC`,
    [postId]
  );
  return rows;
}

export async function fetchCommentRoots(postId, { limit = 6, cursor = null } = {}) {
  const pool = await db();
  const params = [postId, limit];
  let sql = `
    SELECT ${COMMENT_SELECT}
    FROM public.community_comments
    WHERE post_id = $1 AND parent_id IS NULL
  `;
  if (cursor) {
    params.push(cursor);
    sql += ` AND created_at > $3`;
  }
  sql += ` ORDER BY created_at ASC LIMIT $2`;
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function fetchCommentsByParentIds(postId, parentIds) {
  const ids = [...new Set((parentIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT ${COMMENT_SELECT}
     FROM public.community_comments
     WHERE post_id = $1 AND parent_id = ANY($2::uuid[])`,
    [postId, ids]
  );
  return rows;
}

export async function insertComment({ post_id, parent_id, author_id, author_name, body }) {
  const pool = await db();
  const { rows } = await pool.query(
    `INSERT INTO public.community_comments (post_id, parent_id, author_id, author_name, body)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COMMENT_SELECT}`,
    [post_id, parent_id || null, author_id, author_name, body]
  );
  return rows[0];
}

export async function fetchCommentsByAuthor(userId, limit = 200) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT post_id, body FROM public.community_comments WHERE author_id = $1 LIMIT $2`,
    [userId, limit]
  );
  return rows;
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

export async function fetchCommentLikesForCommentIds(commentIds) {
  const ids = [...new Set((commentIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT comment_id, user_id FROM public.community_comment_likes WHERE comment_id = ANY($1::uuid[])`,
    [ids]
  );
  return rows;
}

// ——— Shares ———

export async function fetchSharesByUser(userId, { limit = 11, cursor = null } = {}) {
  const pool = await db();
  const params = [userId, limit];
  let sql = `
    SELECT post_id, created_at FROM public.community_post_shares WHERE user_id = $1
  `;
  if (cursor) {
    params.push(cursor);
    sql += ` AND created_at < $3`;
  }
  sql += ` ORDER BY created_at DESC LIMIT $2`;
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function fetchSharedPostIdsByUser(userId, limit = 200) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT post_id FROM public.community_post_shares WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

export async function upsertPostShare(postId, userId) {
  const pool = await db();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO public.community_post_shares (post_id, user_id, created_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (post_id, user_id) DO UPDATE SET created_at = EXCLUDED.created_at`,
    [postId, userId, now]
  );
}

// ——— Follows ———

export async function countFollowers(userId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM public.community_follows WHERE following_id = $1`,
    [userId]
  );
  return rows[0]?.n ?? 0;
}

export async function countFollowing(userId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM public.community_follows WHERE follower_id = $1`,
    [userId]
  );
  return rows[0]?.n ?? 0;
}

export async function findFollow(followerId, followingId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT follower_id FROM public.community_follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1`,
    [followerId, followingId]
  );
  return rows[0] || null;
}

export async function insertFollow(followerId, followingId) {
  const pool = await db();
  await pool.query(
    `INSERT INTO public.community_follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [followerId, followingId]
  );
}

export async function deleteFollow(followerId, followingId) {
  const pool = await db();
  await pool.query(
    `DELETE FROM public.community_follows WHERE follower_id = $1 AND following_id = $2`,
    [followerId, followingId]
  );
}

export async function fetchFollowingIds(followerId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT following_id FROM public.community_follows WHERE follower_id = $1`,
    [followerId]
  );
  return rows;
}

export async function fetchFollowers(profileUserId, limit = 120) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT follower_id, created_at FROM public.community_follows
     WHERE following_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [profileUserId, limit]
  );
  return rows;
}

export async function fetchFollowing(profileUserId, limit = 120) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT following_id, created_at FROM public.community_follows
     WHERE follower_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [profileUserId, limit]
  );
  return rows;
}

// ——— Embeddings ———

export async function upsertPostEmbedding(postId, embeddingLiteral, model) {
  const pool = await db();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO public.community_post_embeddings (post_id, embedding, model, updated_at)
     VALUES ($1, $2::vector, $3, $4)
     ON CONFLICT (post_id) DO UPDATE SET embedding = EXCLUDED.embedding, model = EXCLUDED.model, updated_at = EXCLUDED.updated_at`,
    [postId, embeddingLiteral, model, now]
  );
}

export async function fetchPostEmbeddings(postIds) {
  const ids = [...new Set((postIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT post_id, embedding::text AS embedding FROM public.community_post_embeddings WHERE post_id = ANY($1::uuid[])`,
    [ids]
  );
  return rows;
}

export async function upsertUserInterestVector(userId, embeddingLiteral, model) {
  const pool = await db();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO public.community_user_interest_vectors (user_id, embedding, model, updated_at)
     VALUES ($1, $2::vector, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET embedding = EXCLUDED.embedding, model = EXCLUDED.model, updated_at = EXCLUDED.updated_at`,
    [userId, embeddingLiteral, model, now]
  );
}

export async function fetchUserInterestVector(userId) {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT embedding::text AS embedding FROM public.community_user_interest_vectors WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

// ——— Analytics ———

export async function countCommunityTable(table) {
  const allowed = new Set([
    "community_posts",
    "community_post_likes",
    "community_comments",
    "community_post_shares",
  ]);
  if (!allowed.has(table)) throw new Error("Invalid table");
  const pool = await db();
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM public."${table}"`);
  return rows[0]?.n ?? 0;
}
