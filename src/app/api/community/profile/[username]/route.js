import { fail, ok } from "@/lib/api";
import { resolveCommunityProfileSegment } from "@/lib/community-member-search";
import {
  resolvePublicDisplayName,
  resolvePublicUsernameLabel,
} from "@/lib/community-profile-privacy";
import { normalizeSavedUsernameHandle, tryNormalizeCommunityUsername } from "@/lib/community-usernames";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { getSessionUser } from "@/lib/session";
import { isCommunityConfigured } from "@/lib/community-server";
import { countFollowers, countFollowing, findFollow, isCommunityDbConfigured } from "@/lib/community-db";
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

  if (!isCommunityConfigured()) {
    return fail("Community unavailable.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  if (!isCommunityDbConfigured()) {
    return fail("Community unavailable.", 503);
  }

  const resolved = await resolveCommunityProfileSegment(normalized);
  if (!resolved) {
    return fail("Profile not found.", 404);
  }

  const { realHandle, user } = resolved;
  const profileUserId = String(user._id);

  let followersCount = 0;
  let followingCount = 0;
  try {
    [followersCount, followingCount] = await Promise.all([
      countFollowers(profileUserId),
      countFollowing(profileUserId),
    ]);
  } catch (fcErr) {
    const message = fcErr instanceof Error ? fcErr.message : String(fcErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Follow count failed", 500);
  }

  const viewer = await getSessionUser(request);
  const viewerId = viewer ? String(viewer._id) : null;
  let viewerState = null;
  if (viewerId) {
    const isSelf = viewerId === profileUserId;
    let isFollowing = false;
    if (!isSelf) {
      try {
        const followRow = await findFollow(viewerId, profileUserId);
        isFollowing = Boolean(followRow);
      } catch {
        isFollowing = false;
      }
    }
    viewerState = { isSelf, isFollowing };
  }

  const verified = hasActivePremium(user) && Boolean(user.showVerifiedBadge);
  const joinedAt = user.createdAt ? new Date(user.createdAt).toISOString() : null;
  const visibility = user.communityProfileVisibility === "private" ? "private" : "public";
  const isPrivateForViewer = visibility === "private" && !(viewerState?.isSelf);
  const isSelf = Boolean(viewerState?.isSelf);

  const displayName = resolvePublicDisplayName(user, { isSelf });
  const publicUsernameLabel = resolvePublicUsernameLabel(realHandle, user, { isSelf });

  return ok({
    profile: {
      id: profileUserId,
      username: realHandle,
      publicUsername: publicUsernameLabel,
      displayName,
      visibility,
      verified: isPrivateForViewer ? false : verified,
      joinedAt: isPrivateForViewer ? null : joinedAt,
      followersCount: isPrivateForViewer ? null : followersCount ?? 0,
      followingCount: isPrivateForViewer ? null : followingCount ?? 0,
      viewer: viewerState,
    },
  });
}
