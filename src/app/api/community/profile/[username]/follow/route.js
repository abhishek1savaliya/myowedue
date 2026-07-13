import { fail, ok } from "@/lib/api";
import { notifyCommunityActivity } from "@/lib/community-notifications";
import { formatUserDisplayName } from "@/lib/format-user-display-name";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { normalizeSavedUsernameHandle, tryNormalizeCommunityUsername } from "@/lib/community-usernames";
import { communitySuggestedCreatorsCacheKey, delRedisKey } from "@/lib/redis";
import { requireUser } from "@/lib/session";
import { isCommunityConfigured } from "@/lib/community-server";
import {
  deleteFollow,
  findFollow,
  findUsernameByHandle,
  findUsernameByUserId,
  insertFollow,
  isCommunityDbConfigured,
} from "@/lib/community-db";

export async function POST(request, { params }) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  if (!isCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  if (!isCommunityDbConfigured()) {
    return fail("Community database is not configured.", 503);
  }

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

  if (!row?.user_id) {
    return fail("Profile not found.", 404);
  }

  const targetId = String(row.user_id);
  const uid = String(user._id);

  if (targetId === uid) {
    return fail("You cannot follow yourself.", 400);
  }

  let existing;
  try {
    existing = await findFollow(uid, targetId);
  } catch {
    existing = null;
  }

  if (existing) {
    try {
      await deleteFollow(uid, targetId);
    } catch (delErr) {
      const message = delErr instanceof Error ? delErr.message : String(delErr);
      const mapped = mapCommunitySupabaseError(message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(message, 500);
    }
    void delRedisKey(communitySuggestedCreatorsCacheKey());
    return ok({ following: false });
  }

  try {
    await insertFollow(uid, targetId);
  } catch (insErr) {
    const message = insErr instanceof Error ? insErr.message : String(insErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message, 500);
  }

  const actorRow = await findUsernameByUserId(uid).catch(() => null);
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
