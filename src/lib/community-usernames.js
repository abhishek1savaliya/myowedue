/** Allowed length for new usernames (must match DB check when migration applied). */
export const COMMUNITY_USERNAME_MIN = 6;
export const COMMUNITY_USERNAME_MAX = 12;

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
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string[]} userIds
 * @returns {Promise<Map<string, string>>} user_id -> username
 */
export async function fetchUsernameMapByUserIds(supabase, userIds) {
  const uniq = [...new Set((userIds || []).map((id) => String(id).trim()).filter(Boolean))];
  if (uniq.length === 0) return new Map();

  const { data, error } = await supabase.from("community_usernames").select("user_id, username").in("user_id", uniq);

  if (error || !data?.length) return new Map();

  const m = new Map();
  for (const row of data) {
    m.set(String(row.user_id), String(row.username));
  }
  return m;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {object[]} posts
 */
export async function attachAuthorUsernamesToPosts(supabase, posts) {
  if (!posts?.length) return posts;
  const ids = [...new Set(posts.map((p) => String(p.author_id || "").trim()).filter(Boolean))];
  const map = await fetchUsernameMapByUserIds(supabase, ids);
  return posts.map((p) => ({
    ...p,
    author_username: map.get(String(p.author_id)) || null,
  }));
}

function collectCommentAuthorIds(nodes, out = []) {
  for (const n of nodes || []) {
    if (n?.author_id != null && String(n.author_id).trim()) out.push(String(n.author_id));
    collectCommentAuthorIds(n.replies, out);
  }
  return out;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {object[]} tree
 */
export async function attachAuthorUsernamesToCommentTree(supabase, tree) {
  const ids = [...new Set(collectCommentAuthorIds(tree))];
  const map = await fetchUsernameMapByUserIds(supabase, ids);

  function walk(nodes) {
    return (nodes || []).map((n) => ({
      ...n,
      author_username: map.get(String(n.author_id)) || null,
      replies: walk(n.replies),
    }));
  }
  return walk(tree);
}
