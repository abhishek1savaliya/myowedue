"use client";

import { formatUserDisplayName } from "@/lib/format-user-display-name";
import { listPendingMutations } from "@/lib/offline/mutation-queue";

export const OFFLINE_POST_ID_PREFIX = "offline-post-";
export const OFFLINE_COMMENT_ID_PREFIX = "offline-comment-";

function parseJson(body) {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function normalizeFeedPost(p) {
  if (!p || typeof p !== "object") return null;
  return {
    ...p,
    share_count: p.share_count ?? 0,
    likeCount: p.likeCount ?? 0,
    commentCount: p.commentCount ?? 0,
    liked: Boolean(p.liked),
    authorVerified: Boolean(p.authorVerified),
  };
}

export function dedupePostsById(posts) {
  if (!Array.isArray(posts)) return [];
  const seen = new Set();
  const out = [];
  for (const post of posts) {
    const id = post?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(post);
  }
  return out;
}

/**
 * @param {{ body: string; user: object | null; queueId?: number | string }} input
 */
export function buildOptimisticCommunityPost({ body, user, queueId }) {
  const now = new Date().toISOString();
  const id = queueId != null ? `${OFFLINE_POST_ID_PREFIX}${queueId}` : `${OFFLINE_POST_ID_PREFIX}${Date.now()}`;
  const authorId = String(user?._id || user?.id || "");

  return normalizeFeedPost({
    id,
    author_id: authorId,
    author_name: formatUserDisplayName(user),
    body: String(body || "").trim(),
    share_count: 0,
    created_at: now,
    updated_at: now,
    likeCount: 0,
    commentCount: 0,
    liked: false,
    offlinePending: true,
    authorUsername: user?.communityUsername || user?.username || "",
    authorVerified: Boolean(user?.isPremium),
    isSelf: true,
  });
}

/**
 * @param {{ postId: string; body: string; user: object | null; parentId?: string | null; queueId?: number | string }} input
 */
export function buildOptimisticCommunityComment({ postId, body, user, parentId = null, queueId }) {
  const now = new Date().toISOString();
  const id = queueId != null ? `${OFFLINE_COMMENT_ID_PREFIX}${queueId}` : `${OFFLINE_COMMENT_ID_PREFIX}${Date.now()}`;

  return {
    id,
    post_id: postId,
    parent_id: parentId || null,
    parentId: parentId || null,
    author_id: String(user?._id || user?.id || ""),
    author_name: formatUserDisplayName(user),
    body: String(body || "").trim(),
    created_at: now,
    replies: [],
    commentLikeCount: 0,
    commentLiked: false,
    offlinePending: true,
  };
}

function isCommunityPostCreate(url, method) {
  const path = String(url || "").split("?")[0];
  return method === "POST" && /\/api\/community\/posts\/?$/.test(path);
}

function parseCommunityCommentTarget(url, method) {
  const path = String(url || "").split("?")[0];
  const match = path.match(/\/api\/community\/posts\/([^/]+)\/comments\/?$/);
  if (method !== "POST" || !match) return null;
  return { postId: match[1] };
}

/**
 * @param {object | null} user
 */
export async function getPendingCommunityPosts(user) {
  const queue = await listPendingMutations();
  return queue
    .filter((item) => isCommunityPostCreate(item.url, item.method))
    .map((item) => {
      const payload = parseJson(item.body);
      return buildOptimisticCommunityPost({
        body: payload?.body || "",
        user,
        queueId: item.id,
      });
    })
    .filter(Boolean);
}

/**
 * @param {string} postId
 * @param {object | null} user
 */
export async function getPendingCommentsForPost(postId, user) {
  const queue = await listPendingMutations();
  const roots = [];
  const repliesByParent = new Map();

  for (const item of queue) {
    const target = parseCommunityCommentTarget(item.url, item.method);
    if (!target || target.postId !== String(postId)) continue;

    const payload = parseJson(item.body);
    const parentId = payload?.parentId || payload?.parent_id || null;
    const comment = buildOptimisticCommunityComment({
      postId,
      body: payload?.body || "",
      user,
      parentId,
      queueId: item.id,
    });

    if (parentId) {
      const list = repliesByParent.get(String(parentId)) || [];
      list.push(comment);
      repliesByParent.set(String(parentId), list);
    } else {
      roots.push(comment);
    }
  }

  function attachReplies(node) {
    const kids = repliesByParent.get(String(node.id)) || [];
    return {
      ...node,
      replies: [...(node.replies || []), ...kids.map(attachReplies)],
    };
  }

  return roots.map(attachReplies);
}

/**
 * @param {Array<object>} serverPosts
 * @param {Array<object>} pendingPosts
 */
export function mergePostsWithPending(serverPosts, pendingPosts) {
  const withoutStale = (serverPosts || []).filter((p) => !String(p?.id || "").startsWith(OFFLINE_POST_ID_PREFIX));
  return dedupePostsById([...(pendingPosts || []), ...withoutStale]);
}

export function isOfflineCommunityId(id) {
  const s = String(id || "");
  return s.startsWith(OFFLINE_POST_ID_PREFIX) || s.startsWith(OFFLINE_COMMENT_ID_PREFIX);
}

export function isQueuedOfflineResponse(data) {
  return Boolean(data?.queued && data?.offline);
}

/**
 * Rewrite offline community ids in queued mutations after earlier items sync.
 * @param {{ url: string; method: string; body?: string | null }} item
 * @param {{ posts: Map<string, string>; comments: Map<string, string> }} maps
 */
export function resolveCommunityOfflineMutation(item, maps) {
  let url = String(item.url || "");
  let body = item.body ?? null;

  for (const [offline, real] of maps.posts) {
    url = url.split(offline).join(real);
  }

  if (body) {
    try {
      const json = JSON.parse(body);
      let changed = false;
      const parentRef = json.parentId ?? json.parent_id;
      if (parentRef) {
        const asPost = maps.posts.get(String(parentRef));
        const asComment = maps.comments.get(String(parentRef));
        if (asPost) {
          json.parentId = asPost;
          json.parent_id = asPost;
          changed = true;
        } else if (asComment) {
          json.parentId = asComment;
          json.parent_id = asComment;
          changed = true;
        }
      }
      if (changed) body = JSON.stringify(json);
    } catch {
      // keep original body
    }
  }

  return { url, body };
}

/**
 * @param {{ id?: number; url: string; method: string }} item
 * @param {object} data
 * @param {{ posts: Map<string, string>; comments: Map<string, string> }} maps
 */
export function recordCommunitySyncIds(item, data, maps) {
  const path = String(item.url || "").split("?")[0];
  if (item.method === "POST" && /\/api\/community\/posts\/?$/.test(path) && data?.post?.id != null) {
    maps.posts.set(`${OFFLINE_POST_ID_PREFIX}${item.id}`, String(data.post.id));
  }
  if (item.method === "POST" && /\/api\/community\/posts\/[^/]+\/comments\/?$/.test(path)) {
    const commentId = data?.comment?.id;
    if (commentId != null) {
      maps.comments.set(`${OFFLINE_COMMENT_ID_PREFIX}${item.id}`, String(commentId));
    }
  }
}
