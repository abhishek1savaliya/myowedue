import { fail, ok } from "@/lib/api";
import { notifyCommunityActivity } from "@/lib/community-notifications";
import { formatUserDisplayName } from "@/lib/format-user-display-name";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { invalidateCommunityCommentsForPost } from "@/lib/redis";
import { requireUser } from "@/lib/session";
import { isCommunityConfigured } from "@/lib/community-server";
import {
  countCommentLikes,
  deleteCommentLike,
  findCommentById,
  findCommentLike,
  insertCommentLike,
  isCommunityDbConfigured,
} from "@/lib/community-db";

export async function POST(request, { params }) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  if (!isCommunityConfigured() || !isCommunityDbConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const { id: postId, commentId } = await params;
  if (!postId || !commentId) return fail("Missing post or comment id", 400);

  const uid = String(user._id);

  try {
    const commentRow = await findCommentById(commentId);
    if (!commentRow || String(commentRow.post_id) !== String(postId)) {
      return fail("Comment not found", 404);
    }

    const existing = await findCommentLike(commentId, uid);

    if (existing) {
      await deleteCommentLike(commentId, uid);
      const commentLikeCount = await countCommentLikes(commentId);
      await invalidateCommunityCommentsForPost(postId);
      return ok({ liked: false, commentLikeCount });
    }

    await insertCommentLike(commentId, uid);

    const ownerId = commentRow.author_id != null ? String(commentRow.author_id) : "";
    if (ownerId && ownerId !== uid) {
      void notifyCommunityActivity({
        recipientUserId: ownerId,
        actorUserId: uid,
        actorName: formatUserDisplayName(user),
        kind: "comment_like",
        postId,
        commentSnippet: commentRow.body,
        metaExtra: { commentId: String(commentId) },
      });
    }

    const commentLikeCount = await countCommentLikes(commentId);
    await invalidateCommunityCommentsForPost(postId);
    return ok({ liked: true, commentLikeCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message, 500);
  }
}
