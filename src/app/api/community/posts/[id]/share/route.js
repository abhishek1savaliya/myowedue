import { fail, ok } from "@/lib/api";
import { notifyCommunityActivity } from "@/lib/community-notifications";
import { formatUserDisplayName } from "@/lib/format-user-display-name";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { invalidateCommunityEngagementCaches } from "@/lib/redis";
import { getSessionUser } from "@/lib/session";
import { isCommunityConfigured } from "@/lib/community-server";
import {
  fetchPostShareMeta,
  incrementShareCount,
  insertFeedSignal,
  isCommunityDbConfigured,
  upsertPostShare,
} from "@/lib/community-db";

/** Increments share_count — allowed without login so guests can share like X. Logged-in users also get a community_post_shares row for the “Shared” feed. */
export async function POST(request, { params }) {
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
    row = await fetchPostShareMeta(postId);
  } catch (fetchErr) {
    const message = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message, 500);
  }
  if (!row) return fail("Post not found", 404);

  let next;
  try {
    next = await incrementShareCount(postId);
  } catch (updErr) {
    const message = updErr instanceof Error ? updErr.message : String(updErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message, 500);
  }

  const user = await getSessionUser(request);
  if (user) {
    try {
      await upsertPostShare(postId, String(user._id));
    } catch (shareErr) {
      console.warn("[community] community_post_shares upsert:", shareErr?.message);
    }
    void insertFeedSignal({
      user_id: String(user._id),
      post_id: postId,
      event_type: "share",
    });
  }

  const ownerId = row.author_id != null ? String(row.author_id) : "";
  const actorId = user ? String(user._id) : "";
  if (ownerId && ownerId !== actorId) {
    void notifyCommunityActivity({
      recipientUserId: ownerId,
      actorUserId: actorId || undefined,
      actorName: user ? formatUserDisplayName(user) : "Someone",
      kind: "post_share",
      postId,
      postBodySnippet: row.body,
    });
  }

  await invalidateCommunityEngagementCaches();

  return ok({ shareCount: next });
}
