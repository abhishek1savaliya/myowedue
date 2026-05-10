import { fail, ok } from "@/lib/api";
import { attachAuthorVerifiedToPosts } from "@/lib/community-author-verified";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { extractPostTopics } from "@/lib/post-topic-extraction";
import { communityFeedCacheKey, clearCommunityCaches, getRedisJSON, setRedisJSON } from "@/lib/redis";
import { getSessionUser, requireUser } from "@/lib/session";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";
import { hasActivePremium } from "@/lib/subscription";

const PAGE_SIZE = 10;
const COMMUNITY_FEED_CACHE_TTL_SEC = 45;

function viewerPayload(sessionUser) {
  if (!sessionUser) return null;
  return {
    isPremium: hasActivePremium(sessionUser),
    showVerifiedBadge: Boolean(sessionUser.showVerifiedBadge),
  };
}

function serveFeedCache(cacheKey, payload, sessionUser) {
  const body = { ...payload, viewer: sessionUser ? viewerPayload(sessionUser) : null };
  void setRedisJSON(cacheKey, body, COMMUNITY_FEED_CACHE_TTL_SEC);
  return ok(body);
}

function displayName(user) {
  const n = String(user?.name || "").trim();
  if (n) return n;
  const f = String(user?.firstName || "").trim();
  const l = String(user?.lastName || "").trim();
  return `${f} ${l}`.trim() || "Member";
}

function aggregateEngagement(likesRows, commentRows, currentUserId) {
  const likeCount = {};
  const commentCount = {};
  const likedByMe = new Set();
  for (const row of likesRows || []) {
    likeCount[row.post_id] = (likeCount[row.post_id] || 0) + 1;
    if (String(row.user_id) === String(currentUserId)) likedByMe.add(row.post_id);
  }
  for (const row of commentRows || []) {
    commentCount[row.post_id] = (commentCount[row.post_id] || 0) + 1;
  }
  return { likeCount, commentCount, likedByMe };
}

function parseFeedFilter(searchParams) {
  const f = String(searchParams.get("filter") || "all").toLowerCase();
  if (f === "mine") return "mine";
  if (f === "liked" || f === "shared") return f;
  return "all";
}

async function enrichPostsWithEngagement(supabase, page, currentUserId) {
  const postIds = page.map((p) => p.id);
  if (postIds.length === 0) return { posts: [] };

  const [likesRes, commentsRes] = await Promise.all([
    supabase.from("community_post_likes").select("post_id, user_id").in("post_id", postIds),
    supabase.from("community_comments").select("post_id").in("post_id", postIds),
  ]);

  if (likesRes.error) return { error: likesRes.error };
  if (commentsRes.error) return { error: commentsRes.error };

  const { likeCount, commentCount, likedByMe } = aggregateEngagement(likesRes.data, commentsRes.data, currentUserId);

  const enriched = page.map((p) => ({
    ...p,
    likeCount: likeCount[p.id] || 0,
    commentCount: commentCount[p.id] || 0,
    liked: likedByMe.has(p.id),
  }));

  return { posts: enriched };
}

async function enrichAndVerifyPosts(supabase, page, currentUserId) {
  const enriched = await enrichPostsWithEngagement(supabase, page, currentUserId);
  if (enriched.error) return enriched;
  if (!enriched.posts?.length) return enriched;
  enriched.posts = await attachAuthorVerifiedToPosts(enriched.posts);
  return enriched;
}

export async function GET(request) {
  const user = await getSessionUser(request);

  if (!isSupabaseCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const supabase = getSupabaseAdmin();
  if (!supabase) return fail("Community database is not configured.", 503);

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const filter = parseFeedFilter(searchParams);

  const currentUserId = user ? String(user._id) : "";
  const viewerCacheId = currentUserId || "anon";
  const feedCacheKey = communityFeedCacheKey(filter, cursor || "", viewerCacheId);

  if ((filter === "liked" || filter === "shared" || filter === "mine") && !user) {
    const payload = { posts: [], nextCursor: null, currentUserId: "", requiresAuth: true, filter };
    return serveFeedCache(feedCacheKey, payload, null);
  }

  const cachedFeed = await getRedisJSON(feedCacheKey);
  if (cachedFeed && typeof cachedFeed === "object" && Array.isArray(cachedFeed.posts)) {
    return ok({ ...cachedFeed, viewer: user ? viewerPayload(user) : null });
  }

  if (filter === "liked") {
    let likesQuery = supabase
      .from("community_post_likes")
      .select("post_id, created_at")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (cursor) {
      likesQuery = likesQuery.lt("created_at", cursor);
    }

    const { data: likeRows, error: lErr } = await likesQuery;
    if (lErr) {
      const mapped = mapCommunitySupabaseError(lErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(lErr.message || "Failed to load likes", 500);
    }

    const likesSlice = likeRows || [];
    const hasMoreLikes = likesSlice.length > PAGE_SIZE;
    const likePage = hasMoreLikes ? likesSlice.slice(0, PAGE_SIZE) : likesSlice;
    const postIds = likePage.map((r) => r.post_id);

    if (postIds.length === 0) {
      return serveFeedCache(feedCacheKey, { posts: [], nextCursor: null, currentUserId, filter }, user);
    }

    const { data: postsRaw, error: pErr } = await supabase
      .from("community_posts")
      .select("id, author_id, author_name, body, share_count, created_at")
      .in("id", postIds);

    if (pErr) {
      const mapped = mapCommunitySupabaseError(pErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(pErr.message || "Failed to load posts", 500);
    }

    const byId = new Map((postsRaw || []).map((p) => [p.id, p]));
    const page = likePage.map((r) => byId.get(r.post_id)).filter(Boolean);

    const enriched = await enrichAndVerifyPosts(supabase, page, currentUserId);
    if (enriched.error) {
      const mapped = mapCommunitySupabaseError(enriched.error.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(enriched.error.message, 500);
    }

    const nextCursor = hasMoreLikes ? likePage[likePage.length - 1]?.created_at : null;
    return serveFeedCache(feedCacheKey, { posts: enriched.posts, nextCursor, currentUserId, filter }, user);
  }

  if (filter === "shared") {
    let sharesQuery = supabase
      .from("community_post_shares")
      .select("post_id, created_at")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (cursor) {
      sharesQuery = sharesQuery.lt("created_at", cursor);
    }

    const { data: shareRows, error: sErr } = await sharesQuery;
    if (sErr) {
      const mapped = mapCommunitySupabaseError(sErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(sErr.message || "Failed to load shares", 500);
    }

    const sharesSlice = shareRows || [];
    const hasMoreShares = sharesSlice.length > PAGE_SIZE;
    const sharePage = hasMoreShares ? sharesSlice.slice(0, PAGE_SIZE) : sharesSlice;
    const postIds = sharePage.map((r) => r.post_id);

    if (postIds.length === 0) {
      return serveFeedCache(feedCacheKey, { posts: [], nextCursor: null, currentUserId, filter }, user);
    }

    const { data: postsRaw, error: pErr } = await supabase
      .from("community_posts")
      .select("id, author_id, author_name, body, share_count, created_at")
      .in("id", postIds);

    if (pErr) {
      const mapped = mapCommunitySupabaseError(pErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(pErr.message || "Failed to load posts", 500);
    }

    const byId = new Map((postsRaw || []).map((p) => [p.id, p]));
    const page = sharePage.map((r) => byId.get(r.post_id)).filter(Boolean);

    const enriched = await enrichAndVerifyPosts(supabase, page, currentUserId);
    if (enriched.error) {
      const mapped = mapCommunitySupabaseError(enriched.error.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(enriched.error.message, 500);
    }

    const nextCursor = hasMoreShares ? sharePage[sharePage.length - 1]?.created_at : null;
    return serveFeedCache(feedCacheKey, { posts: enriched.posts, nextCursor, currentUserId, filter }, user);
  }

  if (filter === "mine") {
    let mineQuery = supabase
      .from("community_posts")
      .select("id, author_id, author_name, body, share_count, created_at")
      .eq("author_id", currentUserId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (cursor) {
      mineQuery = mineQuery.lt("created_at", cursor);
    }

    const { data: minePosts, error: mErr } = await mineQuery;
    if (mErr) {
      const mapped = mapCommunitySupabaseError(mErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(mErr.message || "Failed to load posts", 500);
    }

    const mineSlice = minePosts || [];
    const hasMoreMine = mineSlice.length > PAGE_SIZE;
    const page = hasMoreMine ? mineSlice.slice(0, PAGE_SIZE) : mineSlice;

    if (page.length === 0) {
      return serveFeedCache(feedCacheKey, { posts: [], nextCursor: null, currentUserId, filter }, user);
    }

    const enriched = await enrichAndVerifyPosts(supabase, page, currentUserId);
    if (enriched.error) {
      const mapped = mapCommunitySupabaseError(enriched.error.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(enriched.error.message, 500);
    }

    const nextCursor = hasMoreMine ? page[page.length - 1]?.created_at : null;
    return serveFeedCache(feedCacheKey, { posts: enriched.posts, nextCursor, currentUserId, filter }, user);
  }

  let query = supabase
    .from("community_posts")
    .select("id, author_id, author_name, body, share_count, created_at")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: posts, error: qErr } = await query;
  if (qErr) {
    const mapped = mapCommunitySupabaseError(qErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(qErr.message || "Failed to load posts", 500);
  }

  const slice = posts || [];
  const hasMore = slice.length > PAGE_SIZE;
  const page = hasMore ? slice.slice(0, PAGE_SIZE) : slice;

  if (page.length === 0) {
    return serveFeedCache(feedCacheKey, { posts: [], nextCursor: null, currentUserId, filter }, user);
  }

  const enriched = await enrichAndVerifyPosts(supabase, page, currentUserId);
  if (enriched.error) {
    const mapped = mapCommunitySupabaseError(enriched.error.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(enriched.error.message, 500);
  }

  const nextCursor = hasMore ? page[page.length - 1]?.created_at : null;

  return serveFeedCache(feedCacheKey, { posts: enriched.posts, nextCursor, currentUserId, filter }, user);
}

export async function POST(request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  if (!isSupabaseCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const supabase = getSupabaseAdmin();
  if (!supabase) return fail("Community database is not configured.", 503);

  let body = "";
  try {
    const json = await request.json();
    body = String(json.body || "").trim();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  if (!body || body.length > 280) {
    return fail("Post must be 1–280 characters.", 422);
  }

  const { data, error: insErr } = await supabase
    .from("community_posts")
    .insert({
      author_id: String(user._id),
      author_name: displayName(user),
      body,
    })
    .select("id, author_id, author_name, body, share_count, created_at")
    .single();

  if (insErr) {
    const mapped = mapCommunitySupabaseError(insErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(insErr.message || "Failed to create post", 500);
  }

  const topics = extractPostTopics(body);
  if (topics.length > 0) {
    const rows = topics.map((topic) => ({ post_id: data.id, topic }));
    const { error: topicErr } = await supabase.from("post_topics").insert(rows);
    if (topicErr) {
      const msg = String(topicErr.message || "").toLowerCase();
      const missing = msg.includes("post_topics") && (msg.includes("does not exist") || msg.includes("schema"));
      if (!missing) {
        console.warn("[community] post_topics insert:", topicErr.message);
      }
    }
  }

  await clearCommunityCaches();

  const basePost = { ...data, likeCount: 0, commentCount: 0, liked: false };
  const [post] = await attachAuthorVerifiedToPosts([basePost]);
  return ok({ post });
}
