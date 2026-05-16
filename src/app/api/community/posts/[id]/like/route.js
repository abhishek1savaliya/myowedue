import { fail, ok } from "@/lib/api";
import { notifyCommunityActivity } from "@/lib/community-notifications";
import { formatUserDisplayName } from "@/lib/format-user-display-name";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { clearCommunityCaches } from "@/lib/redis";
import { requireUser } from "@/lib/session";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";
import { countPublicPostLikes, hasPrivateCommunityLikes } from "@/lib/community-private-likes";

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

  const { id: postId } = await params;
  if (!postId) return fail("Missing post id", 400);

  const uid = String(user._id);

  const { data: existing } = await supabase
    .from("community_post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", uid)
    .maybeSingle();

  if (existing) {
    const { error: delErr } = await supabase.from("community_post_likes").delete().eq("post_id", postId).eq("user_id", uid);
    if (delErr) {
      const mapped = mapCommunitySupabaseError(delErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(delErr.message, 500);
    }
    let likeCount = 0;
    try {
      likeCount = await countPublicPostLikes(supabase, postId, uid);
    } catch (countErr) {
      const mapped = mapCommunitySupabaseError(countErr?.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(countErr?.message || "Like count failed", 500);
    }
    await clearCommunityCaches();
    return ok({ liked: false, likeCount });
  }

  const { error: insErr } = await supabase.from("community_post_likes").insert({ post_id: postId, user_id: uid });
  if (insErr) {
    const mapped = mapCommunitySupabaseError(insErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(insErr.message, 500);
  }

  const { data: postRow } = await supabase
    .from("community_posts")
    .select("author_id, body")
    .eq("id", postId)
    .maybeSingle();
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

  void supabase.from("community_feed_signals").insert({
    user_id: uid,
    post_id: postId,
    event_type: "like",
    watch_time_ms: 0,
    scroll_duration_ms: 0,
    dwell_ms: 0,
  });

  let likeCount = 0;
  try {
    likeCount = await countPublicPostLikes(supabase, postId, uid);
  } catch (countErr) {
    const mapped = mapCommunitySupabaseError(countErr?.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(countErr?.message || "Like count failed", 500);
  }

  await clearCommunityCaches();
  return ok({ liked: true, likeCount });
}
