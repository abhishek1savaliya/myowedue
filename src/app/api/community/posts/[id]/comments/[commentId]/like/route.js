import { fail, ok } from "@/lib/api";
import { notifyCommunityActivity } from "@/lib/community-notifications";
import { formatUserDisplayName } from "@/lib/format-user-display-name";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { clearCommunityCaches } from "@/lib/redis";
import { requireUser } from "@/lib/session";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";

export async function POST(request, { params }) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  if (!isSupabaseCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const supabase = getSupabaseAdmin();
  if (!supabase) return fail("Community database is not configured.", 503);

  const { id: postId, commentId } = await params;
  if (!postId || !commentId) return fail("Missing post or comment id", 400);

  const uid = String(user._id);

  const { data: commentRow, error: cErr } = await supabase
    .from("community_comments")
    .select("id, post_id, author_id, body")
    .eq("id", commentId)
    .maybeSingle();

  if (cErr) {
    const mapped = mapCommunitySupabaseError(cErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(cErr.message, 500);
  }
  if (!commentRow || String(commentRow.post_id) !== String(postId)) {
    return fail("Comment not found", 404);
  }

  const { data: existing } = await supabase
    .from("community_comment_likes")
    .select("comment_id")
    .eq("comment_id", commentId)
    .eq("user_id", uid)
    .maybeSingle();

  if (existing) {
    const { error: delErr } = await supabase
      .from("community_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", uid);
    if (delErr) {
      const mapped = mapCommunitySupabaseError(delErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(delErr.message, 500);
    }
    const { count } = await supabase
      .from("community_comment_likes")
      .select("*", { count: "exact", head: true })
      .eq("comment_id", commentId);
    await clearCommunityCaches();
    return ok({ liked: false, commentLikeCount: count ?? 0 });
  }

  const { error: insErr } = await supabase.from("community_comment_likes").insert({
    comment_id: commentId,
    user_id: uid,
  });
  if (insErr) {
    const mapped = mapCommunitySupabaseError(insErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(insErr.message, 500);
  }

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

  const { count } = await supabase
    .from("community_comment_likes")
    .select("*", { count: "exact", head: true })
    .eq("comment_id", commentId);

  await clearCommunityCaches();
  return ok({ liked: true, commentLikeCount: count ?? 0 });
}
