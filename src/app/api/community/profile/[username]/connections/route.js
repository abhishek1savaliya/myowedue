import { fail, ok } from "@/lib/api";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { normalizeSavedUsernameHandle, tryNormalizeCommunityUsername } from "@/lib/community-usernames";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { getSessionUser } from "@/lib/session";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";

function displayName(user) {
  const n = String(user?.name || "").trim();
  if (n) return n;
  return `${String(user?.firstName || "").trim()} ${String(user?.lastName || "").trim()}`.trim() || "Member";
}

export async function GET(request, { params }) {
  const { username: raw } = await params;
  const segment = String(raw ?? "").trim();
  const normalized = normalizeSavedUsernameHandle(segment.replace(/^@+/, ""));
  if (!normalized) return fail("Invalid username.", 422);

  const parsed = tryNormalizeCommunityUsername(normalized);
  if (!parsed.ok) return fail("Profile not found.", 404);

  if (!isSupabaseCommunityConfigured()) return fail("Community unavailable.", 503);
  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const supabase = getSupabaseAdmin();
  if (!supabase) return fail("Community unavailable.", 503);

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
  if (!row?.user_id) return fail("Profile not found.", 404);

  const profileUserId = String(row.user_id);
  const viewer = await getSessionUser(request);
  const viewerId = viewer ? String(viewer._id) : "";

  await connectDB();
  const profileOwner = await User.findById(profileUserId).select("communityProfileVisibility");
  if (!profileOwner) return fail("Profile not found.", 404);

  const isPrivate = profileOwner.communityProfileVisibility === "private";
  const isSelf = viewerId && viewerId === profileUserId;
  if (isPrivate && !isSelf) {
    return ok({ followers: [], following: [], hidden: true });
  }

  const [{ data: followersRows, error: fErr }, { data: followingRows, error: fgErr }] = await Promise.all([
    supabase
      .from("community_follows")
      .select("follower_id")
      .eq("following_id", profileUserId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("community_follows")
      .select("following_id")
      .eq("follower_id", profileUserId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (fErr) {
    const mapped = mapCommunitySupabaseError(fErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(fErr.message || "Followers lookup failed", 500);
  }
  if (fgErr) {
    const mapped = mapCommunitySupabaseError(fgErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(fgErr.message || "Following lookup failed", 500);
  }

  const followerIds = (followersRows || []).map((r) => String(r.follower_id));
  const followingIds = (followingRows || []).map((r) => String(r.following_id));
  const allIds = [...new Set([...followerIds, ...followingIds])];
  if (allIds.length === 0) return ok({ followers: [], following: [], hidden: false });

  const [users, usernamesRes] = await Promise.all([
    User.find({ _id: { $in: allIds } }).select("name firstName lastName").lean(),
    supabase.from("community_usernames").select("user_id, username").in("user_id", allIds),
  ]);

  if (usernamesRes.error) {
    const mapped = mapCommunitySupabaseError(usernamesRes.error.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(usernamesRes.error.message || "Username lookup failed", 500);
  }

  const byUserId = new Map((users || []).map((u) => [String(u._id), u]));
  const byUsername = new Map((usernamesRes.data || []).map((r) => [String(r.user_id), String(r.username || "")]));
  const mapEntry = (uid) => ({
    id: uid,
    username: byUsername.get(uid) || "",
    displayName: displayName(byUserId.get(uid)),
  });

  return ok({
    followers: followerIds.map(mapEntry).filter((x) => x.username),
    following: followingIds.map(mapEntry).filter((x) => x.username),
    hidden: false,
  });
}

