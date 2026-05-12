import { fail, ok } from "@/lib/api";
import { computeTrendingTopics } from "@/lib/community-trending";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { communityTrendingCacheKey, getRedisJSON, setRedisJSON } from "@/lib/redis";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";

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
  if (!isSupabaseCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const supabase = getSupabaseAdmin();
  if (!supabase) return fail("Community database is not configured.", 503);

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 10, 1), 50);

  const cacheKey = communityTrendingCacheKey(limit);
  const cached = await getRedisJSON(cacheKey);
  if (cached && typeof cached === "object" && Array.isArray(cached.topics)) {
    return ok(cached);
  }

  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const { data: posts, error: pErr } = await supabase
    .from("community_posts")
    .select("id, share_count, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  if (pErr) {
    const mapped = mapCommunitySupabaseError(pErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(pErr.message || "Failed to load posts", 500);
  }

  const postList = posts || [];
  if (postList.length === 0) {
    const empty = { topics: [], windowHours: WINDOW_HOURS };
    void setRedisJSON(cacheKey, empty, CACHE_TTL_SEC);
    return ok(empty);
  }

  const postIds = postList.map((p) => p.id);

  const [topicRes, likesRes, commentsRes] = await Promise.all([
    supabase.from("post_topics").select("post_id, topic").in("post_id", postIds),
    supabase.from("community_post_likes").select("post_id").in("post_id", postIds),
    supabase.from("community_comments").select("post_id").in("post_id", postIds),
  ]);

  if (topicRes.error) {
    if (isMissingPostTopics(topicRes.error.message)) {
      const empty = { topics: [], windowHours: WINDOW_HOURS };
      void setRedisJSON(cacheKey, empty, CACHE_TTL_SEC);
      return ok(empty);
    }
    const mapped = mapCommunitySupabaseError(topicRes.error.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(topicRes.error.message || "Failed to load topics", 500);
  }
  if (likesRes.error) {
    const mapped = mapCommunitySupabaseError(likesRes.error.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(likesRes.error.message, 500);
  }
  if (commentsRes.error) {
    const mapped = mapCommunitySupabaseError(commentsRes.error.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(commentsRes.error.message, 500);
  }

  const topics = computeTrendingTopics(postList, topicRes.data || [], likesRes.data || [], commentsRes.data || [], {
    limit,
  });

  const payload = { topics, windowHours: WINDOW_HOURS };
  void setRedisJSON(cacheKey, payload, CACHE_TTL_SEC);
  return ok(payload);
}
