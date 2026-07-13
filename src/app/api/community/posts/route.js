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
import { isCommunityConfigured } from "@/lib/community-server";
import {
  createPost,
  fetchCommentCountsForPosts,
  fetchCommentsByAuthor,
  fetchFeedSignalsByUser,
  fetchFollowingIds,
  fetchLikedPostIdsByUser,
  fetchPostEmbeddings,
  fetchPostLikesByUser,
  fetchPostLikesForPosts,
  fetchPostsByIds,
  fetchSharedPostIdsByUser,
  fetchSharesByUser,
  fetchUserInterestVector,
  insertPostTopics,
  isCommunityDbConfigured,
  listPosts,
  listPostsByTopic,
  upsertPostEmbedding,
  upsertUserInterestVector,
} from "@/lib/community-db";
import {
  aggregateEngagementWithPrivateLikes,
  buildPublicLikesMap,
  communityViewerPayload,
  getPrivateLikeUserIdSet,
} from "@/lib/community-private-likes";
import { enqueueCommunityJob } from "@/lib/queue/producers";
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

async function enrichAndVerifyPosts(page, currentUserId) {
  const postIds = page.map((p) => p.id);
  if (postIds.length === 0) return { posts: [] };

  let likesData = [];
  let commentsData = [];
  try {
    [likesData, commentsData] = await Promise.all([
      fetchPostLikesForPosts(postIds),
      fetchCommentCountsForPosts(postIds),
    ]);
  } catch (error) {
    return { error };
  }

  const verifiedPosts = await attachAuthorVerifiedToPosts(page);

  const privateLikerIds = await getPrivateLikeUserIdSet((likesData || []).map((r) => r.user_id));
  const { likeCount, commentCount, likedByMe } = aggregateEngagementWithPrivateLikes(
    likesData,
    commentsData,
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

  const withPrivacy = await attachPrivacyAwareAuthorLabels(posts, currentUserId);
  return { posts: withPrivacy };
}

export async function GET(request) {
  const user = await getSessionUser(request);

  if (!isCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  if (!isCommunityDbConfigured()) {
    return fail("Community database is not configured.", 503);
  }

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

    let topicSlice = [];
    try {
      topicSlice = await listPostsByTopic(topicNormalized, {
        limit: PAGE_SIZE + 1,
        cursor: cursor || null,
      });
    } catch (tqErr) {
      const message = tqErr instanceof Error ? tqErr.message : String(tqErr);
      const mapped = mapCommunitySupabaseError(message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(message || "Failed to load topic feed", 500);
    }

    const hasMore = topicSlice.length > PAGE_SIZE;
    const page = hasMore ? topicSlice.slice(0, PAGE_SIZE) : topicSlice;

    if (page.length === 0) {
      return serveFeedCache(
        topicCacheKey,
        { posts: [], nextCursor: null, currentUserId, filter, topic: topicNormalized },
        user
      );
    }

    const enriched = await enrichAndVerifyPosts(page, currentUserId);
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
    let likePage = [];
    try {
      likePage = await fetchPostLikesByUser(currentUserId, {
        limit: PAGE_SIZE + 1,
        cursor: cursor || null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const mapped = mapCommunitySupabaseError(message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(message || "Failed to load likes", 500);
    }

    const hasMoreLikes = likePage.length > PAGE_SIZE;
    const likesSlice = hasMoreLikes ? likePage.slice(0, PAGE_SIZE) : likePage;
    const postIds = likesSlice.map((r) => r.post_id);

    if (postIds.length === 0) {
      return serveFeedCache(feedCacheKey, { posts: [], nextCursor: null, currentUserId, filter }, user);
    }

    let postsRaw = [];
    try {
      postsRaw = await fetchPostsByIds(postIds);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const mapped = mapCommunitySupabaseError(message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(message || "Failed to load posts", 500);
    }

    const byId = new Map((postsRaw || []).map((p) => [p.id, p]));
    const page = likesSlice.map((r) => byId.get(r.post_id)).filter(Boolean);

    const enriched = await enrichAndVerifyPosts(page, currentUserId);
    if (enriched.error) {
      const mapped = mapCommunitySupabaseError(enriched.error.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(enriched.error.message, 500);
    }

    const nextCursor = hasMoreLikes ? likesSlice[likesSlice.length - 1]?.created_at : null;
    return serveFeedCache(feedCacheKey, { posts: enriched.posts, nextCursor, currentUserId, filter }, user);
  }

  if (filter === "shared") {
    let sharePage = [];
    try {
      sharePage = await fetchSharesByUser(currentUserId, {
        limit: PAGE_SIZE + 1,
        cursor: cursor || null,
      });
    } catch (sErr) {
      const message = sErr instanceof Error ? sErr.message : String(sErr);
      const mapped = mapCommunitySupabaseError(message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(message || "Failed to load shares", 500);
    }

    const hasMoreShares = sharePage.length > PAGE_SIZE;
    const sharesSlice = hasMoreShares ? sharePage.slice(0, PAGE_SIZE) : sharePage;
    const postIds = sharesSlice.map((r) => r.post_id);

    if (postIds.length === 0) {
      return serveFeedCache(feedCacheKey, { posts: [], nextCursor: null, currentUserId, filter }, user);
    }

    let postsRaw = [];
    try {
      postsRaw = await fetchPostsByIds(postIds);
    } catch (pErr) {
      const message = pErr instanceof Error ? pErr.message : String(pErr);
      const mapped = mapCommunitySupabaseError(message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(pErr.message || "Failed to load posts", 500);
    }

    const byId = new Map((postsRaw || []).map((p) => [p.id, p]));
    const page = sharesSlice.map((r) => byId.get(r.post_id)).filter(Boolean);

    const enriched = await enrichAndVerifyPosts(page, currentUserId);
    if (enriched.error) {
      const mapped = mapCommunitySupabaseError(enriched.error.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(enriched.error.message, 500);
    }

    const nextCursor = hasMoreShares ? sharesSlice[sharesSlice.length - 1]?.created_at : null;
    return serveFeedCache(feedCacheKey, { posts: enriched.posts, nextCursor, currentUserId, filter }, user);
  }

  if (filter === "mine") {
    let mineSlice = [];
    try {
      mineSlice = await listPosts({
        limit: PAGE_SIZE + 1,
        cursor: cursor || null,
        authorId: currentUserId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const mapped = mapCommunitySupabaseError(message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(message || "Failed to load posts", 500);
    }

    const hasMoreMine = mineSlice.length > PAGE_SIZE;
    const page = hasMoreMine ? mineSlice.slice(0, PAGE_SIZE) : mineSlice;

    if (page.length === 0) {
      return serveFeedCache(feedCacheKey, { posts: [], nextCursor: null, currentUserId, filter }, user);
    }

    const enriched = await enrichAndVerifyPosts(page, currentUserId);
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

    try {
      const [
        candidates,
        followingRows,
        likesRows,
        sharesRows,
        myCommentsRows,
        signalRows,
        userVecRow,
      ] = await Promise.all([
        listPosts({ limit: PERSONALIZED_MAX_CANDIDATES, offset: dbOffset }),
        fetchFollowingIds(currentUserId),
        fetchLikedPostIdsByUser(currentUserId, 200),
        fetchSharedPostIdsByUser(currentUserId, 200),
        fetchCommentsByAuthor(currentUserId, 200),
        fetchFeedSignalsByUser(currentUserId, signalsSince, 400),
        fetchUserInterestVector(currentUserId),
      ]);

      const hasMoreHistoricalCandidates = candidates.length === PERSONALIZED_MAX_CANDIDATES;
      const followingSet = new Set((followingRows || []).map((r) => String(r.following_id)));
      const interactedPostIds = new Set([
        ...(likesRows || []).map((r) => r.post_id),
        ...(sharesRows || []).map((r) => r.post_id),
        ...(myCommentsRows || []).map((r) => r.post_id),
      ]);

      const interactedBodies = candidates
        .filter((p) => interactedPostIds.has(p.id))
        .map((p) => String(p.body || ""))
        .join(" ");
      const myCommentBodies = (myCommentsRows || []).map((r) => String(r.body || "")).join(" ");
      const userInterestTokens = `${interactedBodies} ${myCommentBodies}`
        .toLowerCase()
        .split(/[^a-z0-9_]+/g)
        .filter((x) => x && x.length >= 3)
        .slice(0, 500);

      const candidateIds = candidates.map((p) => p.id);

      const [candidateLikes, candidateComments, postVecRows] = await Promise.all([
        candidateIds.length > 0 ? fetchPostLikesForPosts(candidateIds) : [],
        candidateIds.length > 0 ? fetchCommentCountsForPosts(candidateIds) : [],
        candidateIds.length > 0 ? fetchPostEmbeddings(candidateIds) : [],
      ]);

      const privateLikerIds = await getPrivateLikeUserIdSet((candidateLikes || []).map((r) => r.user_id));
      const likesMap = await buildPublicLikesMap(candidateLikes || [], currentUserId, privateLikerIds);
      const commentsMap = new Map();
      for (const r of candidateComments || []) commentsMap.set(r.post_id, (commentsMap.get(r.post_id) || 0) + 1);

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
        if (postVecRows?.length) {
          const postEmbeddingsById = new Map((postVecRows || []).map((r) => [String(r.post_id), r.embedding]));
          let userEmbedding = userVecRow?.embedding || null;
          if (!userEmbedding && userInterestTokens.length > 0) {
            userEmbedding = await embedText(userInterestTokens.join(" "));
            void upsertUserInterestVector(
              currentUserId,
              vectorToPgLiteral(userEmbedding),
              embeddingModelName()
            ).catch(() => {});
          }
          if (userEmbedding) {
            const signalsByPostId = buildSignalsScoreMap(signalRows || []);
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

      const myLikedSet = new Set((likesRows || []).map((r) => r.post_id));
      const verifiedPosts = await attachAuthorVerifiedToPosts(rankedPage);
      const verifiedMap = new Map((verifiedPosts || []).map((p) => [p.id, p.authorVerified]));

      const mappedPosts = rankedPage.map((p) => ({
        ...p,
        likeCount: likesMap.get(p.id) || 0,
        commentCount: commentsMap.get(p.id) || 0,
        liked: myLikedSet.has(p.id),
        authorVerified: verifiedMap.get(p.id) || false,
      }));
      const finalPosts = await attachPrivacyAwareAuthorLabels(mappedPosts, currentUserId);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const mapped = mapCommunitySupabaseError(message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(message || "Failed to build personalized feed", 500);
    }
  }

  try {
    const slice = await listPosts({
      limit: PAGE_SIZE + 1,
      cursor: cursor || null,
    });
    const hasMore = slice.length > PAGE_SIZE;
    const page = hasMore ? slice.slice(0, PAGE_SIZE) : slice;

    if (page.length === 0) {
      return serveFeedCache(feedCacheKey, { posts: [], nextCursor: null, currentUserId, filter }, user);
    }

    const enriched = await enrichAndVerifyPosts(page, currentUserId);
    if (enriched.error) {
      const mapped = mapCommunitySupabaseError(enriched.error.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(enriched.error.message, 500);
    }

    const nextCursor = hasMore ? page[page.length - 1]?.created_at : null;

    return serveFeedCache(feedCacheKey, { posts: enriched.posts, nextCursor, currentUserId, filter }, user);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Failed to load posts", 500);
  }
}

export async function POST(request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  if (!isCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  if (!isCommunityDbConfigured()) {
    return fail("Community database is not configured.", 503);
  }

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

  let data;
  try {
    data = await createPost({
      author_id: String(user._id),
      author_name: displayName(user),
      body,
    });
  } catch (insErr) {
    const message = insErr instanceof Error ? insErr.message : String(insErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Failed to create post", 500);
  }

  enqueueCommunityJob("generate-embedding", { postId: data.id, body }).catch(() => {
    void (async () => {
      try {
        const vector = await embedText(body);
        await upsertPostEmbedding(data.id, vectorToPgLiteral(vector), embeddingModelName());
      } catch {
        // no-op
      }
    })();
  });

  const topics = extractPostTopics(body);
  if (topics.length > 0) {
    const rows = topics.map((topic) => ({ post_id: data.id, topic }));
    try {
      await insertPostTopics(rows);
    } catch (topicErr) {
      const msg = String(topicErr?.message || "").toLowerCase();
      const missing = msg.includes("post_topics") && (msg.includes("does not exist") || msg.includes("schema"));
      if (!missing) {
        console.warn("[community] post_topics insert:", topicErr?.message);
      }
    }
  }

  await clearCommunityCaches();

  void persistCommunityPostSeo(data.id, data).then(() => {
    revalidateCommunityPostSeo(data.id);
  });

  const basePost = { ...data, likeCount: 0, commentCount: 0, liked: false };
  const [verified] = await attachAuthorVerifiedToPosts([basePost]);
  const [withPrivacy] = await attachPrivacyAwareAuthorLabels([verified], String(user._id));
  return ok({ post: withPrivacy });
}
