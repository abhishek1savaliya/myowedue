import { connectDB } from "@/lib/db";
import User from "@/models/User";
import {
  fetchAllUsernames,
  findUsernameByHandle,
  findUsernameByUserId,
  suggestUsernames,
} from "@/lib/community-db";
import {
  getDiscoverableUsernames,
  resolvePublicDisplayName,
} from "@/lib/community-profile-privacy";
import { normalizeSavedUsernameHandle } from "@/lib/community-usernames";
import { isCommunityConfigured } from "@/lib/community-server";

/**
 * @param {string} query
 * @param {number} [limit]
 * @returns {Promise<Array<{ username: string; displayName: string; matchLabel: string }>>}
 */
export async function searchCommunityMembers(query, limit = 12) {
  const q = String(query || "").trim();
  if (!q) return [];

  const lim = Math.min(Math.max(limit, 1), 20);
  const prefix = normalizeSavedUsernameHandle(q).replace(/[^a-z0-9_]/g, "");
  const qLower = q.toLowerCase();

  if (!isCommunityConfigured()) return [];

  await connectDB();

  let allHandles = [];
  try {
    allHandles = await fetchAllUsernames();
  } catch {
    return [];
  }

  const handleByUserId = new Map((allHandles || []).map((r) => [String(r.user_id), r.username]));
  const userIdByHandle = new Map((allHandles || []).map((r) => [r.username, String(r.user_id)]));

  const results = [];
  const seen = new Set();

  function pushResult(realHandle, user, matchLabel) {
    if (!realHandle || seen.has(realHandle)) return;
    seen.add(realHandle);
    results.push({
      username: realHandle,
      displayName: resolvePublicDisplayName(user, { isSelf: false }),
      matchLabel,
    });
  }

  if (prefix.length >= 1) {
    let rpcRows = [];
    try {
      rpcRows = await suggestUsernames(prefix, lim * 2);
    } catch {
      rpcRows = [];
    }
    for (const row of rpcRows || []) {
      if (results.length >= lim) break;
      const uname = row?.username;
      if (!uname) continue;
      const uid = userIdByHandle.get(uname);
      let user = null;
      if (uid) {
        user = await User.findById(uid)
          .select(
            "name firstName lastName communityPublicName communityPublicNameEnabled communityPublicUsername communityPublicUsernameEnabled"
          )
          .lean();
        const discoverable = getDiscoverableUsernames(uname, user || {});
        if (user && !discoverable.some((h) => h.startsWith(prefix) || h === prefix)) continue;
      }
      pushResult(uname, user || { name: "Member" }, `@${uname}`);
    }

    const aliasUsers = await User.find({
      communityPublicUsername: { $regex: `^${prefix}` },
    })
      .select(
        "name firstName lastName communityPublicName communityPublicNameEnabled communityPublicUsername communityPublicUsernameEnabled"
      )
      .limit(lim)
      .lean();

    for (const user of aliasUsers) {
      if (results.length >= lim) break;
      const alias = normalizeSavedUsernameHandle(user.communityPublicUsername);
      const discoverable = getDiscoverableUsernames(null, user);
      if (!discoverable.includes(alias)) continue;
      const real = handleByUserId.get(String(user._id));
      if (real) pushResult(real, user, `@${alias}`);
    }
  }

  if (q.length >= 2 && results.length < lim) {
    const nameRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const nameUsers = await User.find({
      $or: [
        { communityPublicName: nameRegex },
        {
          communityPublicNameEnabled: true,
          $or: [{ name: nameRegex }, { firstName: nameRegex }, { lastName: nameRegex }],
        },
      ],
    })
      .select(
        "name firstName lastName communityPublicName communityPublicNameEnabled communityPublicUsername communityPublicUsernameEnabled"
      )
      .limit(lim * 2)
      .lean();

    for (const user of nameUsers) {
      if (results.length >= lim) break;
      const real = handleByUserId.get(String(user._id));
      if (!real) continue;
      const display = resolvePublicDisplayName(user, { isSelf: false });
      if (!display.toLowerCase().includes(qLower)) continue;
      pushResult(real, user, display);
    }
  }

  return results.slice(0, lim);
}

/**
 * Resolve profile route segment to canonical @handle (real or public alias).
 * @param {string} segment
 * @returns {Promise<{ realHandle: string; user: object } | null>}
 */
export async function resolveCommunityProfileSegment(segment) {
  const normalized = normalizeSavedUsernameHandle(segment);
  if (!normalized) return null;

  if (!isCommunityConfigured()) return null;

  const userSelect =
    "name firstName lastName communityPublicName communityPublicNameEnabled communityPublicUsername communityPublicUsernameEnabled communityProfileVisibility showVerifiedBadge subscriptionEndDate isPremium subscriptionPlan createdAt";

  let rowExact = null;
  try {
    rowExact = await findUsernameByHandle(normalized);
  } catch {
    return null;
  }

  if (rowExact?.user_id) {
    await connectDB();
    const user = await User.findById(String(rowExact.user_id)).select(userSelect).lean();
    if (!user) return null;
    return { realHandle: rowExact.username, user };
  }

  await connectDB();
  const byAlias = await User.findOne({ communityPublicUsername: normalized }).select(userSelect).lean();
  if (!byAlias) return null;

  const userId = String(byAlias._id);
  let handleRow = null;
  try {
    handleRow = await findUsernameByUserId(userId);
  } catch {
    return null;
  }
  const realHandle = handleRow?.username;
  if (!realHandle) return null;

  const discoverable = getDiscoverableUsernames(realHandle, byAlias);
  if (!discoverable.includes(normalized)) return null;

  return { realHandle, user: byAlias };
}
