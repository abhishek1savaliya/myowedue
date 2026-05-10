import { fail, ok } from "@/lib/api";
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
    await clearCommunityCaches();
    return ok({ liked: false });
  }

  const { error: insErr } = await supabase.from("community_post_likes").insert({ post_id: postId, user_id: uid });
  if (insErr) {
    const mapped = mapCommunitySupabaseError(insErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(insErr.message, 500);
  }
  await clearCommunityCaches();
  return ok({ liked: true });
}
