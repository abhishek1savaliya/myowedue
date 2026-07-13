import { fail, ok } from "@/lib/api";
import { notifyCommunityActivity } from "@/lib/community-notifications";
import { formatUserDisplayName } from "@/lib/format-user-display-name";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { clearCommunityCaches } from "@/lib/redis";
import { requireUser } from "@/lib/session";
import { isSupabaseCommunityConfigured } from "@/lib/supabase-server";
import { countPublicPostLikes, hasPrivateCommunityLikes } from "@/lib/community-private-likes";
import {
  deletePostLike,
  fetchPostAuthorBody,
  findPostLike,
  insertFeedSignalLike,
  insertPostLike,
  isCommunityDbConfigured,
} from "@/lib/community-db";

export async function POST(request, { params }) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  if (!isSupabaseCommunityConfigured() || !isCommunityDbConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const { id: postId } = await params;
  if (!postId) return fail("Missing post id", 400);

  const uid = String(user._id);

  try {
    const existing = await findPostLike(postId, uid);

    if (existing) {
      await deletePostLike(postId, uid);
      const likeCount = await countPublicPostLikes(postId, uid);
      await clearCommunityCaches();
      return ok({ liked: false, likeCount });
    }

    await insertPostLike(postId, uid);

    const postRow = await fetchPostAuthorBody(postId);
    if (postRow?.author_id && String(postRow.author_id) !== uid && !hasPrivateCommunityLikes(user)) {
      void notifyCommunityActivity({
        recipientUserId: String(postRow.author_id),
        actorUserId: uid,
        actorName: formatUserDisplayName(user),
        kind: "post_like",
        postId,
        postBodySnippet: postRow.body,
      });
    }

    void insertFeedSignalLike(uid, postId);

    const likeCount = await countPublicPostLikes(postId, uid);
    await clearCommunityCaches();
    return ok({ liked: true, likeCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message, 500);
  }
}
