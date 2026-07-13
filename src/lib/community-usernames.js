/** Allowed length for new usernames (must match DB check when migration applied). */
export const COMMUNITY_USERNAME_MIN = 6;
export const COMMUNITY_USERNAME_MAX = 21;

/** Reserved handles (lowercase). */
export const RESERVED_COMMUNITY_USERNAMES = new Set([
  "admin",
  "administrator",
  "support",
  "help",
  "official",
  "owedue",
  "owe",
  "due",
  "community",
  "system",
  "mod",
  "moderator",
  "staff",
  "team",
  "security",
  "root",
  "api",
  "www",
  "mail",
  "null",
  "undefined",
  "everyone",
  "here",
]);

function usernameCharsRegex() {
  return new RegExp(`^[a-z0-9_]{${COMMUNITY_USERNAME_MIN},${COMMUNITY_USERNAME_MAX}}$`);
}

/**
 * @param {string} raw
 * @returns {string} normalized lowercase username
 */
export function normalizeCommunityUsername(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
  if (!usernameCharsRegex().test(s)) {
    throw new Error(
      `Username must be ${COMMUNITY_USERNAME_MIN}–${COMMUNITY_USERNAME_MAX} characters: lowercase letters, numbers, and underscores only.`
    );
  }
  if (RESERVED_COMMUNITY_USERNAMES.has(s)) {
    throw new Error("That username is reserved.");
  }
  return s;
}

/**
 * Non-throwing validation for forms (save button + submit handler).
 * @param {string} raw
 * @returns {{ ok: true, normalized: string } | { ok: false, error: string }}
 */
export function tryNormalizeCommunityUsername(raw) {
  try {
    return { ok: true, normalized: normalizeCommunityUsername(raw) };
  } catch (e) {
    return { ok: false, error: String(e?.message || "Invalid username") };
  }
}

/** Compare handles from DB / state (trim, lowercase, strip leading @). */
export function normalizeSavedUsernameHandle(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
}

/** Public community profile URL for a handle (path only). Empty input → /community. */
export function communityProfilePathByUsername(raw) {
  const s = normalizeSavedUsernameHandle(raw);
  if (!s) return "/community";
  return `/community/user/${encodeURIComponent(s)}`;
}
