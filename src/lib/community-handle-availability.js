import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { lookupCommunityUsernameInAlgolia } from "@/lib/community-algolia";
import { findUsernameByHandle, isCommunityDbConfigured } from "@/lib/community-db";
import {
  COMMUNITY_USERNAME_MAX,
  COMMUNITY_USERNAME_MIN,
  RESERVED_COMMUNITY_USERNAMES,
} from "@/lib/community-usernames";

/** @returns {{ status: string; available: boolean | null; needed?: number } | null} */
export function evaluateCommunityHandleFormat(s) {
  if (s.length === 0) {
    return { status: "empty", available: null };
  }
  if (!/^[a-z0-9_]+$/.test(s)) {
    return { status: "invalid_chars", available: false };
  }
  if (s.length < COMMUNITY_USERNAME_MIN) {
    return {
      status: "short",
      available: false,
      needed: COMMUNITY_USERNAME_MIN - s.length,
    };
  }
  if (s.length > COMMUNITY_USERNAME_MAX) {
    return { status: "long", available: false };
  }
  if (RESERVED_COMMUNITY_USERNAMES.has(s)) {
    return { status: "reserved", available: false };
  }
  return null;
}

/**
 * True if another member already uses this string as a public @username alias.
 * @param {string} normalized
 * @param {string} excludeUserId
 */
export async function isCommunityPublicUsernameTaken(normalized, excludeUserId) {
  if (!normalized) return false;
  await connectDB();
  const other = await User.findOne({
    communityPublicUsername: normalized,
    _id: { $ne: excludeUserId },
  })
    .select("_id")
    .lean();
  return Boolean(other);
}

/**
 * Live availability for canonical handles and public aliases (same namespace).
 * @param {string} normalized — already normalized lowercase handle
 * @param {string} excludeUserId — current user id
 * @param {{ supabase?: unknown }} [opts] — legacy; ignored
 */
export async function checkCommunityHandleAvailability(normalized, excludeUserId, opts = {}) {
  const configured = isCommunityDbConfigured();
  const baseMeta = {
    configured,
    min: COMMUNITY_USERNAME_MIN,
    max: COMMUNITY_USERNAME_MAX,
    normalized,
  };

  const format = evaluateCommunityHandleFormat(normalized);
  if (format) return { ...baseMeta, ...format };

  const uid = String(excludeUserId);

  if (await isCommunityPublicUsernameTaken(normalized, uid)) {
    return { ...baseMeta, status: "taken", available: false };
  }

  if (!configured) {
    return { ...baseMeta, configured: false, status: "unconfigured", available: null };
  }

  const algoliaHit = await lookupCommunityUsernameInAlgolia(normalized);
  if (algoliaHit?.userId) {
    if (algoliaHit.userId === uid) {
      return { ...baseMeta, status: "yours", available: true };
    }
    return { ...baseMeta, status: "taken", available: false };
  }

  try {
    const row = await findUsernameByHandle(normalized);
    if (!row) {
      return { ...baseMeta, status: "available", available: true };
    }
    if (String(row.user_id) === uid) {
      return { ...baseMeta, status: "yours", available: true };
    }
    return { ...baseMeta, status: "taken", available: false };
  } catch (e) {
    return {
      ...baseMeta,
      status: "error",
      available: null,
      error: e instanceof Error ? e.message : "Lookup failed",
    };
  }
}

/**
 * @returns {Promise<string | null>} Error message when unavailable, else null.
 */
export async function assertCommunityHandleAvailable(normalized, excludeUserId, opts = {}) {
  if (!normalized) return null;
  const result = await checkCommunityHandleAvailability(normalized, excludeUserId, opts);
  if (result.status === "taken") {
    return "That @username is already taken.";
  }
  if (result.available === false && result.status !== "yours") {
    return "That @username is not available.";
  }
  return null;
}
