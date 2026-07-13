import { fail, ok } from "@/lib/api";
import { computeTrendingTopics } from "@/lib/community-trending";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { COMMUNITY_TRENDING_AGGREGATE_CAP, communityTrendingCacheKey, getRedisJSON, setRedisJSON } from "@/lib/redis";
import { isCommunityConfigured } from "@/lib/community-server";
import {
  fetchCommentCountsForPosts,
  fetchPostLikesForPosts,
  fetchTopicsForPosts,
  isCommunityDbConfigured,
  listPostsForTrending,
} from "@/lib/community-db";

const WINDOW_HOURS = 24;
const CACHE_TTL_SEC = 300;

function isMissingPostTopics(msg) {
  const m = String(msg || "").toLowerCase();
  return (
    (m.includes("post_topics") && (m.includes("does not exist") || m.includes("not find") || m.includes("schema"))) ||
    m.includes("pgrst205")
  );
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

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 10, 1), 50);

  const cacheKey = communityTrendingCacheKey();
  const cached = await getRedisJSON(cacheKey);
  if (cached && typeof cached === "object" && Array.isArray(cached.topics)) {
    return ok({
      ...cached,
      topics: cached.topics.slice(0, limit),
    });
  }

  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  let postList;
  try {
    postList = await listPostsForTrending(since, 500);
  } catch (pErr) {
    const message = pErr instanceof Error ? pErr.message : String(pErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Failed to load posts", 500);
  }

  if (!postList?.length) {
    const empty = { topics: [], windowHours: WINDOW_HOURS };
    void setRedisJSON(cacheKey, empty, CACHE_TTL_SEC);
    return ok(empty);
  }

  const postIds = postList.map((p) => p.id);

  let topicData = [];
  let likesData = [];
  let commentsData = [];
  try {
    [topicData, likesData, commentsData] = await Promise.all([
      fetchTopicsForPosts(postIds),
      fetchPostLikesForPosts(postIds),
      fetchCommentCountsForPosts(postIds),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingPostTopics(message)) {
      const empty = { topics: [], windowHours: WINDOW_HOURS };
      void setRedisJSON(cacheKey, empty, CACHE_TTL_SEC);
      return ok(empty);
    }
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Failed to load topics", 500);
  }

  const topicsFull = computeTrendingTopics(postList, topicData || [], likesData || [], commentsData || [], {
    limit: COMMUNITY_TRENDING_AGGREGATE_CAP,
  });

  const payload = { topics: topicsFull, windowHours: WINDOW_HOURS };
  void setRedisJSON(cacheKey, payload, CACHE_TTL_SEC);
  return ok({
    ...payload,
    topics: topicsFull.slice(0, limit),
  });
}
