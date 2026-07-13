import "server-only";

import { fetchUsernameMapByUserIds as fetchUsernameMapFromDb } from "@/lib/community-db";

/**
 * @param {string[]} userIds
 * @returns {Promise<Map<string, string>>}
 */
export async function fetchUsernameMapByUserIds(userIds) {
  return fetchUsernameMapFromDb(userIds);
}

/**
 * @param {object[]} posts
 */
export async function attachAuthorUsernamesToPosts(posts) {
  if (!posts?.length) return posts || [];
  const ids = [...new Set(posts.map((p) => String(p.author_id || "").trim()).filter(Boolean))];
  const map = await fetchUsernameMapByUserIds(ids);
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
 * @param {object[]} tree
 */
export async function attachAuthorUsernamesToCommentTree(tree) {
  const ids = [...new Set(collectCommentAuthorIds(tree))];
  const map = await fetchUsernameMapByUserIds(ids);

  function walk(nodes) {
    return (nodes || []).map((n) => ({
      ...n,
      author_username: map.get(String(n.author_id)) || null,
      replies: walk(n.replies),
    }));
  }
  return walk(tree);
}
