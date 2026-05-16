import { fail, ok } from "@/lib/api";
import { attachAuthorVerifiedToPosts } from "@/lib/community-author-verified";
import { embedText, embeddingModelName, vectorToPgLiteral } from "@/lib/communityEmbeddings";
import { buildSignalsScoreMap, rerankWithPhase2 } from "@/lib/communityPhase2Ranking";
import { attachPrivacyAwareAuthorLabels } from "@/lib/community-author-display";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { normalizeCommunityTopicParam } from "@/lib/community-topic";
import { rankPersonalizedPosts } from "@/lib/communityPersonalization";
import { extractPostTopics } from "@/lib/post-topic-extraction";
import {
  communityFeedCacheKey,
  communityFeedTopicCacheKey,
  communityPersonalizedFeedCacheKey,
  clearCommunityCaches,
  getRedisJSON,
  setRedisJSON,
} from "@/lib/redis";
import { getSessionUser, requireUser } from "@/lib/session";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";
import {
  aggregateEngagementWithPrivateLikes,
  buildPublicLikesMap,
  communityViewerPayload,
  getPrivateLikeUserIdSet,
} from "@/lib/community-private-likes";
import { enqueueCommunityJob } from "@/lib/queue/producers";
import { COMMUNITY_POST_LIST_SELECT } from "@/lib/community-post-edit-window";
import { persistCommunityPostSeo, revalidateCommunityPostSeo } from "@/lib/community-post-seo";

const PAGE_SIZE = 10;
const COMMUNITY_FEED_CACHE_TTL_SEC = 120;
const PHASE2_SIGNAL_WINDOW_DAYS = 30;
const PERSONALIZED_CURSOR_PREFIX = "p2:";
const PERSONALIZED_MAX_CANDIDATES = 200;

function viewerPayload(sessionUser) {
  return communityViewerPayload(sessionUser);
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

function parseFeedFilter(searchParams) {
  const f = String(searchParams.get("filter") || "all").toLowerCase();
  if (f === "mine") return "mine";
  if (f === "liked" || f === "shared") return f;
  return "all";
}

function parsePersonalizedCursor(cursorValue) {
  const raw = String(cursorValue || "");
  if (!raw.startsWith(PERSONALIZED_CURSOR_PREFIX)) return null;
  const payload = raw.slice(PERSONALIZED_CURSOR_PREFIX.length);
  const [rankPart, dbPart] = payload.split(":");
  const rankOffset = Number(rankPart || 0);
  const dbOffset = Number(dbPart || 0);
  return {
    rankOffset: Number.isFinite(rankOffset) && rankOffset >= 0 ? rankOffset : 0,
    dbOffset: Number.isFinite(dbOffset) && dbOffset >= 0 ? dbOffset : 0,
  };
}

function buildPersonalizedCursor(rankOffset, dbOffset) {
  return `${PERSONALIZED_CURSOR_PREFIX}${Math.max(0, Number(rankOffset) || 0)}:${Math.max(0, Number(dbOffset) || 0)}`;
}

async function enrichAndVerifyPosts(supabase, page, currentUserId) {
  const postIds = page.map((p) => p.id);
  if (postIds.length === 0) return { posts: [] };

  const [likesRes, commentsRes, verifiedPosts] = await Promise.all([
    supabase.from("community_post_likes").select("post_id, user_id").in("post_id", postIds),
    supabase.from("community_comments").select("post_id").in("post_id", postIds),
    attachAuthorVerifiedToPosts(page),
  ]);

  if (likesRes.error) return { error: likesRes.error };
  if (commentsRes.error) return { error: commentsRes.error };

  const privateLikerIds = await getPrivateLikeUserIdSet((likesRes.data || []).map((r) => r.user_id));
  const { likeCount, commentCount, likedByMe } = aggregateEngagementWithPrivateLikes(
    likesRes.data,
    commentsRes.data,
    currentUserId,
    privateLikerIds
  );

  const verifiedMap = new Map((verifiedPosts || []).map((p) => [p.id, p.authorVerified]));

  const posts = page.map((p) => ({
    ...p,
    likeCount: likeCount[p.id] || 0,
    commentCount: commentCount[p.id] || 0,
    liked: likedByMe.has(p.id),
    authorVerified: verifiedMap.get(p.id) || false,
  }));

  const withPrivacy = await attachPrivacyAwareAuthorLabels(supabase, posts, currentUserId);
  return { posts: withPrivacy };
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
  const parsedPersonalizedCursor = parsePersonalizedCursor(cursor);
  const isPersonalizedCursor = Boolean(parsedPersonalizedCursor);

  const currentUserId = user ? String(user._id) : "";
  const viewerCacheId = currentUserId || "anon";
  const feedCacheKey = communityFeedCacheKey(filter, cursor || "", viewerCacheId);
  const topicNormalized = filter === "all" ? normalizeCommunityTopicParam(searchParams.get("topic")) : "";

  if (topicNormalized) {
    const topicCacheKey = communityFeedTopicCacheKey(topicNormalized, cursor || "", viewerCacheId);
    const cachedTopic = await getRedisJSON(topicCacheKey);
    if (cachedTopic && typeof cachedTopic === "object" && Array.isArray(cachedTopic.posts)) {
      return ok({ ...cachedTopic, viewer: user ? viewerPayload(user) : null });
    }

    let topicQuery = supabase
      .from("community_posts")
      .select(`${COMMUNITY_POST_LIST_SELECT}, post_topics!inner(topic)`)
      .eq("post_topics.topic", topicNormalized)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (cursor) {
      topicQuery = topicQuery.lt("created_at", cursor);
    }

    const { data: topicPostsRaw, error: tqErr } = await topicQuery;
    if (tqErr) {
      const mapped = mapCommunitySupabaseError(tqErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(tqErr.message || "Failed to load topic feed", 500);
    }

    const slice = (topicPostsRaw || []).map((row) => {
      const { post_topics: _pt, ...rest } = row;
      return rest;
    });
    const hasMore = slice.length > PAGE_SIZE;
    const page = hasMore ? slice.slice(0, PAGE_SIZE) : slice;

    if (page.length === 0) {
      return serveFeedCache(
        topicCacheKey,
        { posts: [], nextCursor: null, currentUserId, filter, topic: topicNormalized },
        user
      );
    }

    const enriched = await enrichAndVerifyPosts(supabase, page, currentUserId);
    if (enriched.error) {
      const mapped = mapCommunitySupabaseError(enriched.error.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(enriched.error.message, 500);
    }

    const nextCursor = hasMore ? page[page.length - 1]?.created_at : null;
    return serveFeedCache(
      topicCacheKey,
      { posts: enriched.posts, nextCursor, currentUserId, filter, topic: topicNormalized },
      user
    );
  }

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
      .select(COMMUNITY_POST_LIST_SELECT)
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
      .select(COMMUNITY_POST_LIST_SELECT)
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
      .select(COMMUNITY_POST_LIST_SELECT)
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

  // Personalized feed for signed-in users (supports infinite scrolling via p2 cursor).
  if (filter === "all" && user && (!cursor || isPersonalizedCursor)) {
    const pageOffset = parsedPersonalizedCursor?.rankOffset || 0;
    const dbOffset = parsedPersonalizedCursor?.dbOffset || 0;
    const personalizedCacheKey = `${communityPersonalizedFeedCacheKey(currentUserId)}:${dbOffset}:${pageOffset}`;
    const cachedPersonalized = await getRedisJSON(personalizedCacheKey);
    if (cachedPersonalized && typeof cachedPersonalized === "object" && Array.isArray(cachedPersonalized.posts)) {
      return ok({ ...cachedPersonalized, viewer: viewerPayload(user) });
    }

    const signalsSince = new Date(Date.now() - PHASE2_SIGNAL_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const [candidateRes, followingRes, likesRes, sharesRes, myCommentsRes, signalRes, userVecRes] = await Promise.all([
      supabase
        .from("community_posts")
        .select(COMMUNITY_POST_LIST_SELECT)
        .order("created_at", { ascending: false })
        .range(dbOffset, dbOffset + PERSONALIZED_MAX_CANDIDATES - 1),
      supabase.from("community_follows").select("following_id").eq("follower_id", currentUserId),
      supabase.from("community_post_likes").select("post_id").eq("user_id", currentUserId).limit(200),
      supabase.from("community_post_shares").select("post_id").eq("user_id", currentUserId).limit(200),
      supabase.from("community_comments").select("post_id, body").eq("author_id", currentUserId).limit(200),
      supabase
        .from("community_feed_signals")
        .select("post_id, event_type, watch_time_ms, scroll_duration_ms, dwell_ms")
        .eq("user_id", currentUserId)
        .gte("created_at", signalsSince)
        .order("created_at", { ascending: false })
        .limit(400),
      supabase.from("community_user_interest_vectors").select("embedding").eq("user_id", currentUserId).maybeSingle(),
    ]);

    for (const err of [candidateRes.error, followingRes.error, likesRes.error, sharesRes.error, myCommentsRes.error, signalRes.error, userVecRes.error]) {
      if (err) {
        const mapped = mapCommunitySupabaseError(err.message, setup);
        if (mapped) return fail(mapped, 503);
        return fail(err.message || "Failed to build personalized feed", 500);
      }
    }

    const candidates = candidateRes.data || [];
    const hasMoreHistoricalCandidates = candidates.length === PERSONALIZED_MAX_CANDIDATES;
    const followingSet = new Set((followingRes.data || []).map((r) => String(r.following_id)));
    const interactedPostIds = new Set([
      ...(likesRes.data || []).map((r) => r.post_id),
      ...(sharesRes.data || []).map((r) => r.post_id),
      ...(myCommentsRes.data || []).map((r) => r.post_id),
    ]);

    const interactedBodies = candidates
      .filter((p) => interactedPostIds.has(p.id))
      .map((p) => String(p.body || ""))
      .join(" ");
    const myCommentBodies = (myCommentsRes.data || []).map((r) => String(r.body || "")).join(" ");
    const userInterestTokens = `${interactedBodies} ${myCommentBodies}`
      .toLowerCase()
      .split(/[^a-z0-9_]+/g)
      .filter((x) => x && x.length >= 3)
      .slice(0, 500);

    const candidateIds = candidates.map((p) => p.id);

    const [candidateLikes, candidateComments, postVecRes] = await Promise.all([
      candidateIds.length > 0
        ? supabase.from("community_post_likes").select("post_id, user_id").in("post_id", candidateIds)
        : { data: [], error: null },
      candidateIds.length > 0
        ? supabase.from("community_comments").select("post_id").in("post_id", candidateIds)
        : { data: [], error: null },
      candidateIds.length > 0
        ? supabase.from("community_post_embeddings").select("post_id, embedding").in("post_id", candidateIds)
        : { data: [], error: null },
    ]);

    if (candidateLikes.error || candidateComments.error) {
      const err = candidateLikes.error || candidateComments.error;
      const mapped = mapCommunitySupabaseError(err.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(err.message || "Failed to enrich personalized feed", 500);
    }

    const privateLikerIds = await getPrivateLikeUserIdSet((candidateLikes.data || []).map((r) => r.user_id));
    const likesMap = await buildPublicLikesMap(candidateLikes.data || [], currentUserId, privateLikerIds);
    const commentsMap = new Map();
    for (const r of candidateComments.data || []) commentsMap.set(r.post_id, (commentsMap.get(r.post_id) || 0) + 1);

    const phase1 = rankPersonalizedPosts({
      candidates,
      likesMap,
      commentsMap,
      followingSet,
      userInterestTokens,
      pageSize: candidates.length,
    });

    let rankedAll = phase1.posts;

    try {
      if (!postVecRes.error && postVecRes.data?.length) {
        const postEmbeddingsById = new Map((postVecRes.data || []).map((r) => [String(r.post_id), r.embedding]));
        let userEmbedding = userVecRes.data?.embedding || null;
        if (!userEmbedding && userInterestTokens.length > 0) {
          userEmbedding = await embedText(userInterestTokens.join(" "));
          supabase.from("community_user_interest_vectors").upsert(
            {
              user_id: currentUserId,
              embedding: vectorToPgLiteral(userEmbedding),
              model: embeddingModelName(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          ).then(() => {}).catch(() => {});
        }
        if (userEmbedding) {
          const signalsByPostId = buildSignalsScoreMap(signalRes.data || []);
          rankedAll = rerankWithPhase2({
            phase1Posts: phase1.posts,
            phase1ScoresByPostId: phase1.scoreMap,
            postEmbeddingsById,
            userEmbedding,
            signalsByPostId,
            pageSize: phase1.posts.length,
          });
        }
      }
    } catch {
      // Graceful fallback to phase1.
    }

    const rankedPage = rankedAll.slice(pageOffset, pageOffset + PAGE_SIZE);
    const nextPersonalizedOffset = pageOffset + PAGE_SIZE;
    let nextCursor = null;
    if (nextPersonalizedOffset < rankedAll.length) {
      nextCursor = buildPersonalizedCursor(nextPersonalizedOffset, dbOffset);
    } else if (hasMoreHistoricalCandidates) {
      nextCursor = buildPersonalizedCursor(0, dbOffset + PERSONALIZED_MAX_CANDIDATES);
    }

    const myLikedSet = new Set((likesRes.data || []).map((r) => r.post_id));
    const verifiedPosts = await attachAuthorVerifiedToPosts(rankedPage);
    const verifiedMap = new Map((verifiedPosts || []).map((p) => [p.id, p.authorVerified]));

    const mappedPosts = rankedPage.map((p) => ({
      ...p,
      likeCount: likesMap.get(p.id) || 0,
      commentCount: commentsMap.get(p.id) || 0,
      liked: myLikedSet.has(p.id),
      authorVerified: verifiedMap.get(p.id) || false,
    }));
    const finalPosts = await attachPrivacyAwareAuthorLabels(supabase, mappedPosts, currentUserId);

    const payload = {
      posts: finalPosts,
      nextCursor,
      currentUserId,
      filter,
      feedMode: "personalized_v1",
      personalization: { phase: "phase2-hybrid" },
    };
    await setRedisJSON(personalizedCacheKey, payload, COMMUNITY_FEED_CACHE_TTL_SEC);
    return ok({ ...payload, viewer: viewerPayload(user) });
  }

  let query = supabase
    .from("community_posts")
    .select(COMMUNITY_POST_LIST_SELECT)
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
    .select(COMMUNITY_POST_LIST_SELECT)
    .single();

  if (insErr) {
    const mapped = mapCommunitySupabaseError(insErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(insErr.message || "Failed to create post", 500);
  }

  enqueueCommunityJob("generate-embedding", { postId: data.id, body }).catch(() => {
    void (async () => {
      try {
        const vector = await embedText(body);
        await supabase.from("community_post_embeddings").upsert(
          {
            post_id: data.id,
            embedding: vectorToPgLiteral(vector),
            model: embeddingModelName(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "post_id" }
        );
      } catch {
        // no-op
      }
    })();
  });

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

  void persistCommunityPostSeo(supabase, data.id, data).then(() => {
    revalidateCommunityPostSeo(data.id);
  });

  const basePost = { ...data, likeCount: 0, commentCount: 0, liked: false };
  const [verified] = await attachAuthorVerifiedToPosts([basePost]);
  const [withPrivacy] = await attachPrivacyAwareAuthorLabels(supabase, [verified], String(user._id));
  return ok({ post: withPrivacy });
}
