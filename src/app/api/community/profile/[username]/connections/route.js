import { fail, ok } from "@/lib/api";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { normalizeSavedUsernameHandle, tryNormalizeCommunityUsername } from "@/lib/community-usernames";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { getSessionUser } from "@/lib/session";
import { isCommunityConfigured } from "@/lib/community-server";
import {
  fetchFollowers,
  fetchFollowing,
  fetchUsernameMapByUserIds,
  findUsernameByHandle,
  isCommunityDbConfigured,
} from "@/lib/community-db";

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

  if (!isCommunityConfigured()) return fail("Community unavailable.", 503);
  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  if (!isCommunityDbConfigured()) return fail("Community unavailable.", 503);

  let row;
  try {
    row = await findUsernameByHandle(parsed.normalized);
    if (!row?.user_id) {
      row = await findUsernameByHandle(parsed.normalized, { ilike: true });
    }
  } catch (qErr) {
    const message = qErr instanceof Error ? qErr.message : String(qErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Lookup failed", 500);
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

  let followersRows = [];
  let followingRows = [];
  try {
    [followersRows, followingRows] = await Promise.all([
      fetchFollowers(profileUserId, 100),
      fetchFollowing(profileUserId, 100),
    ]);
  } catch (fErr) {
    const message = fErr instanceof Error ? fErr.message : String(fErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Followers lookup failed", 500);
  }

  const followerIds = (followersRows || []).map((r) => String(r.follower_id));
  const followingIds = (followingRows || []).map((r) => String(r.following_id));
  const allIds = [...new Set([...followerIds, ...followingIds])];
  if (allIds.length === 0) return ok({ followers: [], following: [], hidden: false });

  const [users, usernameMap] = await Promise.all([
    User.find({ _id: { $in: allIds } }).select("name firstName lastName").lean(),
    fetchUsernameMapByUserIds(allIds),
  ]);

  const byUserId = new Map((users || []).map((u) => [String(u._id), u]));
  const mapEntry = (uid) => ({
    id: uid,
    username: usernameMap.get(uid) || "",
    displayName: displayName(byUserId.get(uid)),
  });

  return ok({
    followers: followerIds.map(mapEntry).filter((x) => x.username),
    following: followingIds.map(mapEntry).filter((x) => x.username),
    hidden: false,
  });
}
