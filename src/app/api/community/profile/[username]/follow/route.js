import { fail, ok } from "@/lib/api";
import { notifyCommunityActivity } from "@/lib/community-notifications";
import { formatUserDisplayName } from "@/lib/format-user-display-name";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { normalizeSavedUsernameHandle, tryNormalizeCommunityUsername } from "@/lib/community-usernames";
import { communitySuggestedCreatorsCacheKey, delRedisKey } from "@/lib/redis";
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

  const { username: raw } = await params;
  const segment = String(raw ?? "").trim();
  const normalized = normalizeSavedUsernameHandle(segment.replace(/^@+/, ""));
  if (!normalized) {
    return fail("Invalid username.", 422);
  }

  const parsed = tryNormalizeCommunityUsername(normalized);
  if (!parsed.ok) {
    return fail("Profile not found.", 404);
  }

  const { data: rowExact, error: qErr } = await supabase
    .from("community_usernames")
    .select("user_id")
    .eq("username", parsed.normalized)
    .maybeSingle();

  if (qErr) {
    const mapped = mapCommunitySupabaseError(qErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(qErr.message || "Lookup failed", 500);
  }

  let row = rowExact;
  if (!row?.user_id) {
    const { data: rowInsensitive, error: iErr } = await supabase
      .from("community_usernames")
      .select("user_id")
      .ilike("username", parsed.normalized)
      .maybeSingle();
    if (iErr) {
      const mapped = mapCommunitySupabaseError(iErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(iErr.message || "Lookup failed", 500);
    }
    row = rowInsensitive;
  }

  if (!row?.user_id) {
    return fail("Profile not found.", 404);
  }

  const targetId = String(row.user_id);
  const uid = String(user._id);

  if (targetId === uid) {
    return fail("You cannot follow yourself.", 400);
  }

  const { data: existing } = await supabase
    .from("community_follows")
    .select("follower_id")
    .eq("follower_id", uid)
    .eq("following_id", targetId)
    .maybeSingle();

  if (existing) {
    const { error: delErr } = await supabase
      .from("community_follows")
      .delete()
      .eq("follower_id", uid)
      .eq("following_id", targetId);
    if (delErr) {
      const mapped = mapCommunitySupabaseError(delErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(delErr.message, 500);
    }
    void delRedisKey(communitySuggestedCreatorsCacheKey());
    return ok({ following: false });
  }

  const { error: insErr } = await supabase
    .from("community_follows")
    .insert({ follower_id: uid, following_id: targetId });
  if (insErr) {
    const mapped = mapCommunitySupabaseError(insErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(insErr.message, 500);
  }

  const { data: actorRow } = await supabase
    .from("community_usernames")
    .select("username")
    .eq("user_id", uid)
    .maybeSingle();
  const actorCommunityUsername = actorRow?.username ? String(actorRow.username) : null;

  void notifyCommunityActivity({
    recipientUserId: targetId,
    actorUserId: uid,
    actorName: formatUserDisplayName(user),
    kind: "user_follow",
    metaExtra: actorCommunityUsername ? { actorCommunityUsername } : {},
  });

  void delRedisKey(communitySuggestedCreatorsCacheKey());
  return ok({ following: true });
}
