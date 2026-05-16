import { tryNormalizeCommunityUsername } from "@/lib/community-usernames";

export const COMMUNITY_PUBLIC_NAME_MAX = 80;

/** @param {{ firstName?: string; lastName?: string; name?: string }} user */
export function realCommunityDisplayName(user) {
  const fromParts = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
  return fromParts || String(user?.name || "").trim() || "Member";
}

/**
 * Name shown on posts/profiles to other users.
 * @param {object} user — Mongo user doc or safeUser shape
 * @param {{ isSelf?: boolean }} [opts]
 */
export function resolvePublicDisplayName(user, { isSelf = false } = {}) {
  if (!user) return "Member";
  if (isSelf) return realCommunityDisplayName(user);

  const alias = String(user.communityPublicName || "").trim();
  if (user.communityPublicNameEnabled) {
    return alias || realCommunityDisplayName(user);
  }
  return alias || "Member";
}

/**
 * @handles discoverable in search (real @, public alias, or both).
 * @param {string | null | undefined} realHandle — canonical community_usernames handle
 * @param {object} user
 */
export function getDiscoverableUsernames(realHandle, user) {
  const real = String(realHandle || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
  const aliasRaw = String(user?.communityPublicUsername || "").trim();
  const aliasParsed = aliasRaw ? tryNormalizeCommunityUsername(aliasRaw) : null;
  const alias = aliasParsed?.ok ? aliasParsed.normalized : "";

  if (user?.communityPublicUsernameEnabled) {
    const out = new Set();
    if (real) out.add(real);
    if (alias) out.add(alias);
    return [...out];
  }
  if (alias) return [alias];
  return real ? [real] : [];
}

/** Display @handle for other users (may hide real handle). */
export function resolvePublicUsernameLabel(realHandle, user, { isSelf = false } = {}) {
  const real = String(realHandle || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
  if (isSelf) return real || null;

  const aliasRaw = String(user?.communityPublicUsername || "").trim();
  const aliasParsed = aliasRaw ? tryNormalizeCommunityUsername(aliasRaw) : null;
  const alias = aliasParsed?.ok ? aliasParsed.normalized : "";

  if (user?.communityPublicUsernameEnabled) {
    return alias || real || null;
  }
  return alias || null;
}

/** Strings others may use to find this member by name. */
export function getDiscoverableDisplayNames(user) {
  const real = realCommunityDisplayName(user);
  const alias = String(user?.communityPublicName || "").trim();
  if (user?.communityPublicNameEnabled) {
    return alias ? [alias] : [real];
  }
  return alias ? [alias] : [];
}

/** Whether a search query matches this user's discoverable identity. */
export function memberMatchesDiscoveryQuery(user, realHandle, queryRaw) {
  const q = String(queryRaw || "").trim().toLowerCase();
  if (!q) return false;

  const names = getDiscoverableDisplayNames(user);
  for (const n of names) {
    if (n.toLowerCase().includes(q)) return true;
  }

  const handles = getDiscoverableUsernames(realHandle, user);
  const qUser = q.replace(/^@+/, "").replace(/[^a-z0-9_]/g, "");
  for (const h of handles) {
    if (h.includes(qUser) || qUser.includes(h)) return true;
    if (h.startsWith(qUser) || qUser.startsWith(h)) return true;
  }
  return false;
}

export function validateCommunityPrivacyPayload(body) {
  const out = {};
  const errors = [];

  if (typeof body.communityPublicName === "string") {
    const name = body.communityPublicName.trim().slice(0, COMMUNITY_PUBLIC_NAME_MAX);
    out.communityPublicName = name;
  }
  if (typeof body.communityPublicNameEnabled === "boolean") {
    out.communityPublicNameEnabled = body.communityPublicNameEnabled;
  }
  if (typeof body.communityPublicUsername === "string") {
    const raw = body.communityPublicUsername.trim();
    if (!raw) {
      out.communityPublicUsername = "";
    } else {
      const parsed = tryNormalizeCommunityUsername(raw);
      if (!parsed.ok) errors.push(parsed.error);
      else out.communityPublicUsername = parsed.normalized;
    }
  }
  if (typeof body.communityPublicUsernameEnabled === "boolean") {
    out.communityPublicUsernameEnabled = body.communityPublicUsernameEnabled;
  }

  if (errors.length) return { ok: false, error: errors[0] };
  return { ok: true, updates: out };
}
