import { fail, ok } from "@/lib/api";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { fetchUsernameMapByUserIds } from "@/lib/community-usernames-server";
import { communitySuggestedCreatorsCacheKey, getRedisJSON, setRedisJSON } from "@/lib/redis";
import { getSessionUser } from "@/lib/session";
import { isCommunityConfigured } from "@/lib/community-server";
import {
  fetchCommentCountsForPosts,
  fetchFollowsByFollowingIds,
  fetchFollowingAmong,
  fetchPostLikesForPosts,
  isCommunityDbConfigured,
  listPostsSince,
} from "@/lib/community-db";

const WINDOW_DAYS = 30;
const POST_SAMPLE = 650;
const CHUNK = 200;
const CANDIDATE_CAP = 28;
const CACHE_LIST_CAP = 15;
const CACHE_TTL_SEC = 300;

function filterCreatorsForViewer(list, viewerId, limit) {
  const filtered = viewerId ? (list || []).filter((c) => String(c.user_id) !== String(viewerId)) : [...(list || [])];
  return filtered.slice(0, limit);
}

function chunkIds(ids) {
  const list = [...new Set(ids.map((id) => String(id)).filter(Boolean))];
  const out = [];
  for (let i = 0; i < list.length; i += CHUNK) {
    out.push(list.slice(i, i + CHUNK));
  }
  return out;
}

function scoreAuthor({ posts, likes, comments, followers }) {
  const p = Number(posts) || 0;
  const l = Number(likes) || 0;
  const c = Number(comments) || 0;
  const f = Math.min(Number(followers) || 0, 8000);
  const engagement = p * 4 + l * 1 + c * 2;
  const social = Math.log1p(f) * 6;
  return Math.round((engagement + social) * 100) / 100;
}

export async function GET(request) {
  if (!isCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  if (!isCommunityDbConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const user = await getSessionUser(request);
  const viewerId = user ? String(user._id) : "";

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 3, 1), 10);

  const cacheKey = communitySuggestedCreatorsCacheKey();
  const cached = await getRedisJSON(cacheKey);
  if (cached && typeof cached === "object" && Array.isArray(cached.creators)) {
    const sliced = filterCreatorsForViewer(cached.creators, viewerId, limit);
    const creators = await hydrateViewerFollowing(viewerId, sliced);
    return ok({ creators, windowDays: WINDOW_DAYS });
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let postList;
  try {
    postList = await listPostsSince(since, { limit: POST_SAMPLE });
  } catch (pErr) {
    const message = pErr instanceof Error ? pErr.message : String(pErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Failed to load posts", 500);
  }

  if (!postList?.length) {
    const empty = { creators: [], windowDays: WINDOW_DAYS };
    void setRedisJSON(cacheKey, empty, CACHE_TTL_SEC);
    return ok(empty);
  }

  const postIdToAuthor = new Map();
  /** @type {Map<string, { posts: number; likes: number; comments: number; followers: number; display_name: string }>} */
  const byAuthor = new Map();

  for (const row of postList) {
    const aid = String(row.author_id || "").trim();
    if (!aid) continue;
    const pid = String(row.id);
    postIdToAuthor.set(pid, aid);
    if (!byAuthor.has(aid)) {
      byAuthor.set(aid, { posts: 0, likes: 0, comments: 0, followers: 0, display_name: String(row.author_name || "Member") });
    }
    const agg = byAuthor.get(aid);
    agg.posts += 1;
    agg.display_name = String(row.author_name || agg.display_name);
  }

  const postIds = [...postIdToAuthor.keys()];

  const likeRows = [];
  const commentRows = [];
  for (const part of chunkIds(postIds)) {
    if (part.length === 0) continue;
    try {
      const [lr, cr] = await Promise.all([
        fetchPostLikesForPosts(part),
        fetchCommentCountsForPosts(part),
      ]);
      likeRows.push(...(lr || []));
      commentRows.push(...(cr || []));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const mapped = mapCommunitySupabaseError(message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(message || "Failed to load engagement", 500);
    }
  }

  const likesByPost = {};
  for (const r of likeRows) {
    const pid = String(r.post_id);
    likesByPost[pid] = (likesByPost[pid] || 0) + 1;
  }
  const commentsByPost = {};
  for (const r of commentRows) {
    const pid = String(r.post_id);
    commentsByPost[pid] = (commentsByPost[pid] || 0) + 1;
  }

  for (const pid of postIds) {
    const aid = postIdToAuthor.get(pid);
    if (!aid) continue;
    const agg = byAuthor.get(aid);
    if (!agg) continue;
    agg.likes += likesByPost[pid] || 0;
    agg.comments += commentsByPost[pid] || 0;
  }

  const prelim = [];
  for (const [userId, u] of byAuthor) {
    if (u.posts < 1) continue;
    prelim.push({
      user_id: userId,
      display_name: u.display_name,
      post_count: u.posts,
      likes_received: u.likes,
      comments_received: u.comments,
      pre_score: u.posts * 4 + u.likes + u.comments * 2,
    });
  }
  prelim.sort((a, b) => b.pre_score - a.pre_score || b.post_count - a.post_count);
  const candidateIds = prelim.slice(0, CANDIDATE_CAP).map((r) => r.user_id);

  const followerCounts = new Map();
  if (candidateIds.length > 0) {
    try {
      const followRows = await fetchFollowsByFollowingIds(candidateIds);
      for (const r of followRows || []) {
        const fid = String(r.following_id);
        followerCounts.set(fid, (followerCounts.get(fid) || 0) + 1);
      }
    } catch (fErr) {
      const message = fErr instanceof Error ? fErr.message : String(fErr);
      const mapped = mapCommunitySupabaseError(message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(message || "Failed to load follows", 500);
    }
  }

  const usernameMap = await fetchUsernameMapByUserIds(candidateIds);

  const ranked = [];
  for (const row of prelim) {
    if (!usernameMap.has(row.user_id)) continue;
    const followers = followerCounts.get(row.user_id) || 0;
    const score = scoreAuthor({
      posts: row.post_count,
      likes: row.likes_received,
      comments: row.comments_received,
      followers,
    });
    ranked.push({
      user_id: row.user_id,
      username: usernameMap.get(row.user_id),
      display_name: row.display_name,
      post_count: row.post_count,
      likes_received: row.likes_received,
      comments_received: row.comments_received,
      followers_count: followers,
      score,
    });
  }

  ranked.sort((a, b) => b.score - a.score || b.followers_count - a.followers_count);

  const creatorsPayload = ranked.slice(0, CACHE_LIST_CAP);

  void setRedisJSON(cacheKey, { creators: creatorsPayload, windowDays: WINDOW_DAYS }, CACHE_TTL_SEC);

  const sliced = filterCreatorsForViewer(creatorsPayload, viewerId, limit);
  const creators = await hydrateViewerFollowing(viewerId, sliced);
  return ok({ creators, windowDays: WINDOW_DAYS });
}

/**
 * @param {string} viewerId
 * @param {object[]} slice
 */
async function hydrateViewerFollowing(viewerId, slice) {
  if (!viewerId || slice.length === 0) {
    return slice.map((c) => {
      const { score: _s, ...rest } = c;
      return { ...rest, viewer_follows: false };
    });
  }
  const ids = slice.map((c) => c.user_id);
  try {
    const rows = await fetchFollowingAmong(viewerId, ids);
    const following = new Set((rows || []).map((r) => String(r.following_id)));
    return slice.map((c) => {
      const { score: _s, ...rest } = c;
      return { ...rest, viewer_follows: following.has(String(c.user_id)) };
    });
  } catch {
    return slice.map((c) => {
      const { score: _s, ...rest } = c;
      return { ...rest, viewer_follows: false };
    });
  }
}
