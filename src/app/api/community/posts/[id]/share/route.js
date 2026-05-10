import { fail, ok } from "@/lib/api";
import { notifyCommunityActivity, formatUserDisplayName } from "@/lib/community-notifications";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { clearCommunityCaches } from "@/lib/redis";
import { getSessionUser } from "@/lib/session";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";

/** Increments share_count — allowed without login so guests can share like X. Logged-in users also get a community_post_shares row for the “Shared” feed. */
export async function POST(request, { params }) {
  if (!isSupabaseCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const supabase = getSupabaseAdmin();
  if (!supabase) return fail("Community database is not configured.", 503);

  const { id: postId } = await params;
  if (!postId) return fail("Missing post id", 400);

  const { data: row, error: fetchErr } = await supabase
    .from("community_posts")
    .select("share_count, author_id, body")
    .eq("id", postId)
    .maybeSingle();

  if (fetchErr) {
    const mapped = mapCommunitySupabaseError(fetchErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(fetchErr.message, 500);
  }
  if (!row) return fail("Post not found", 404);

  const next = Number(row.share_count || 0) + 1;
  const { error: updErr } = await supabase.from("community_posts").update({ share_count: next }).eq("id", postId);
  if (updErr) {
    const mapped = mapCommunitySupabaseError(updErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(updErr.message, 500);
  }

  const user = await getSessionUser(request);
  if (user) {
    const { error: shareErr } = await supabase.from("community_post_shares").upsert(
      {
        post_id: postId,
        user_id: String(user._id),
        created_at: new Date().toISOString(),
      },
      { onConflict: "post_id,user_id" }
    );
    if (shareErr) {
      console.warn("[community] community_post_shares upsert:", shareErr.message);
    }
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

  await clearCommunityCaches();

  return ok({ shareCount: next });
}
