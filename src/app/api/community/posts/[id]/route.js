import { fail, ok } from "@/lib/api";
import { attachAuthorVerifiedToPosts } from "@/lib/community-author-verified";
import { attachPrivacyAwareAuthorLabels } from "@/lib/community-author-display";
import { isCommunityPostEditWindowOpen } from "@/lib/community-post-edit-window";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { extractPostTopics } from "@/lib/post-topic-extraction";
import { persistCommunityPostSeo, revalidateCommunityPostSeo } from "@/lib/community-post-seo";
import { clearCommunityCaches } from "@/lib/redis";
import { getSessionUser, requireUser } from "@/lib/session";
import { hasActivePremium } from "@/lib/subscription";
import { isCommunityConfigured } from "@/lib/community-server";
import {
  deletePost,
  deletePostTopics,
  fetchCommentCountsForPosts,
  fetchPostById,
  fetchPostByIdFull,
  fetchPostLikesForPosts,
  insertPostTopics,
  isCommunityDbConfigured,
  updatePostBody,
} from "@/lib/community-db";
import {
  aggregateEngagementWithPrivateLikes,
  communityViewerPayload,
  getPrivateLikeUserIdSet,
} from "@/lib/community-private-likes";

export async function GET(request, { params }) {
  const user = await getSessionUser(request);

  if (!isCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const { id: postId } = await params;
  if (!postId) return fail("Missing post id", 400);

  const currentUserId = user ? String(user._id) : "";

  if (!isCommunityDbConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  try {
    const row = await fetchPostById(postId);
    if (!row) return fail("Post not found", 404);

    const [likesData, commentsData] = await Promise.all([
      fetchPostLikesForPosts([postId]),
      fetchCommentCountsForPosts([postId]),
    ]);

    const privateLikerIds = await getPrivateLikeUserIdSet((likesData || []).map((r) => r.user_id));
    const { likeCount, commentCount, likedByMe } = aggregateEngagementWithPrivateLikes(
      likesData,
      commentsData,
      currentUserId,
      privateLikerIds
    );
    const base = {
      ...row,
      likeCount: likeCount[row.id] || 0,
      commentCount: commentCount[row.id] || 0,
      liked: likedByMe.has(row.id),
    };
    const [verified] = await attachAuthorVerifiedToPosts([base]);
    const [post] = await attachPrivacyAwareAuthorLabels([verified], currentUserId);

    return ok({ post, currentUserId, viewer: communityViewerPayload(user) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Failed to load post", 500);
  }
}

export async function PATCH(request, { params }) {
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

  const { id: postId } = await params;
  if (!postId) return fail("Missing post id", 400);

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

  let row;
  try {
    row = await fetchPostByIdFull(postId);
  } catch (qErr) {
    const message = qErr instanceof Error ? qErr.message : String(qErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Failed to load post", 500);
  }
  if (!row) return fail("Post not found", 404);

  if (String(row.author_id) !== String(user._id)) {
    return fail("You can only edit your own posts.", 403);
  }

  if (!hasActivePremium(user)) {
    return fail("Editing posts is a Pro feature. Free accounts can delete posts only.", 403);
  }

  if (!isCommunityPostEditWindowOpen(row.created_at)) {
    return fail("You can only edit a post within 5 minutes of posting.", 403);
  }

  try {
    await updatePostBody(postId, body);
  } catch (updErr) {
    const message = updErr instanceof Error ? updErr.message : String(updErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Failed to update post", 500);
  }

  try {
    await deletePostTopics(postId);
  } catch (delTopicsErr) {
    const msg = String(delTopicsErr?.message || "").toLowerCase();
    const missing = msg.includes("post_topics") && (msg.includes("does not exist") || msg.includes("schema"));
    if (!missing) console.warn("[community] post_topics delete:", delTopicsErr?.message);
  }

  const topics = extractPostTopics(body);
  if (topics.length > 0) {
    const topicRows = topics.map((topic) => ({ post_id: postId, topic }));
    try {
      await insertPostTopics(topicRows);
    } catch (topicErr) {
      const msg = String(topicErr?.message || "").toLowerCase();
      const missing = msg.includes("post_topics") && (msg.includes("does not exist") || msg.includes("schema"));
      if (!missing) console.warn("[community] post_topics insert:", topicErr?.message);
    }
  }

  await clearCommunityCaches();

  const currentUserId = String(user._id);
  let fresh;
  try {
    fresh = await fetchPostByIdFull(postId);
  } catch {
    return fail("Post updated but could not reload.", 500);
  }
  if (!fresh) return fail("Post updated but could not reload.", 500);

  const [likesData, commentsData] = await Promise.all([
    fetchPostLikesForPosts([postId]),
    fetchCommentCountsForPosts([postId]),
  ]);

  const privateLikerIds = await getPrivateLikeUserIdSet((likesData || []).map((r) => r.user_id));
  const { likeCount, commentCount, likedByMe } = aggregateEngagementWithPrivateLikes(
    likesData,
    commentsData,
    currentUserId,
    privateLikerIds
  );
  const base = {
    ...fresh,
    likeCount: likeCount[fresh.id] || 0,
    commentCount: commentCount[fresh.id] || 0,
    liked: likedByMe.has(fresh.id),
  };
  const [verified] = await attachAuthorVerifiedToPosts([base]);
  const [post] = await attachPrivacyAwareAuthorLabels([verified], currentUserId);

  void persistCommunityPostSeo(postId, fresh).then(() => {
    revalidateCommunityPostSeo(postId);
  });

  return ok({ post });
}

export async function DELETE(request, { params }) {
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

  const { id: postId } = await params;
  if (!postId) return fail("Missing post id", 400);

  let row;
  try {
    row = await fetchPostByIdFull(postId);
  } catch (qErr) {
    const message = qErr instanceof Error ? qErr.message : String(qErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Failed to load post", 500);
  }
  if (!row) return fail("Post not found", 404);

  if (String(row.author_id) !== String(user._id)) {
    return fail("You can only delete your own posts.", 403);
  }

  try {
    await deletePost(postId);
  } catch (delErr) {
    const message = delErr instanceof Error ? delErr.message : String(delErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Failed to delete post", 500);
  }

  await clearCommunityCaches();
  revalidateCommunityPostSeo(postId);
  return ok({ ok: true });
}
