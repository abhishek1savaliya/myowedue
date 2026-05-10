import { fail, ok } from "@/lib/api";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { normalizeSavedUsernameHandle, tryNormalizeCommunityUsername } from "@/lib/community-usernames";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { getSessionUser } from "@/lib/session";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";
import { hasActivePremium } from "@/lib/subscription";

/**
 * GET — public member profile by community @username (no private fields).
 * When signed in, includes whether the viewer follows this profile and basic counts.
 */
export async function GET(request, { params }) {
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

  if (!isSupabaseCommunityConfigured()) {
    return fail("Community unavailable.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return fail("Community unavailable.", 503);
  }

  const { data: row, error: qErr } = await supabase
    .from("community_usernames")
    .select("user_id")
    .eq("username", parsed.normalized)
    .maybeSingle();

  if (qErr) {
    const mapped = mapCommunitySupabaseError(qErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(qErr.message || "Lookup failed", 500);
  }

  if (!row?.user_id) {
    return fail("Profile not found.", 404);
  }

  const profileUserId = String(row.user_id);

  const [{ count: followersCount, error: fcErr }, { count: followingCount, error: fgErr }] = await Promise.all([
    supabase.from("community_follows").select("*", { count: "exact", head: true }).eq("following_id", profileUserId),
    supabase.from("community_follows").select("*", { count: "exact", head: true }).eq("follower_id", profileUserId),
  ]);

  if (fcErr) {
    const mapped = mapCommunitySupabaseError(fcErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(fcErr.message || "Followers count failed", 500);
  }
  if (fgErr) {
    const mapped = mapCommunitySupabaseError(fgErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(fgErr.message || "Following count failed", 500);
  }

  const viewer = await getSessionUser(request);
  const viewerId = viewer ? String(viewer._id) : null;
  let viewerState = null;
  if (viewerId) {
    const isSelf = viewerId === profileUserId;
    let isFollowing = false;
    if (!isSelf) {
      const { data: followRow } = await supabase
        .from("community_follows")
        .select("follower_id")
        .eq("follower_id", viewerId)
        .eq("following_id", profileUserId)
        .maybeSingle();
      isFollowing = Boolean(followRow);
    }
    viewerState = { isSelf, isFollowing };
  }

  await connectDB();
  const user = await User.findById(profileUserId).select(
    "name firstName lastName createdAt showVerifiedBadge subscriptionEndDate isPremium subscriptionPlan"
  );

  if (!user) {
    return fail("Profile not found.", 404);
  }

  const displayName = String(
    user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Member"
  ).trim();
  const verified = hasActivePremium(user) && Boolean(user.showVerifiedBadge);
  const joinedAt = user.createdAt ? new Date(user.createdAt).toISOString() : null;

  return ok({
    profile: {
      id: String(user._id),
      username: parsed.normalized,
      displayName,
      verified,
      joinedAt,
      followersCount: followersCount ?? 0,
      followingCount: followingCount ?? 0,
      viewer: viewerState,
    },
  });
}
