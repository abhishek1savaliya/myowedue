import { fail, ok } from "@/lib/api";
import { notifyCommunityActivity } from "@/lib/community-notifications";
import { formatUserDisplayName } from "@/lib/format-user-display-name";
import { attachAuthorUsernamesToCommentTree } from "@/lib/community-usernames-server";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import {
  communityCommentsCacheKey,
  getRedisJSON,
  invalidateCommunityCommentsForPost,
  invalidateCommunityEngagementCaches,
  setRedisJSON,
} from "@/lib/redis";
import { getSessionUser, requireUser } from "@/lib/session";
import { isCommunityConfigured } from "@/lib/community-server";
import {
  fetchAllCommentsForPost,
  fetchCommentLikesForCommentIds,
  fetchCommentRoots,
  fetchCommentsByParentIds,
  fetchPostAuthorBody,
  findCommentWithPost,
  insertComment,
  insertFeedSignal,
  isCommunityDbConfigured,
} from "@/lib/community-db";

const COMMUNITY_COMMENTS_CACHE_TTL_SEC = 60;

function collectCommentIds(nodes, out = []) {
  for (const n of nodes || []) {
    const id = commentRowId(n);
    if (id) out.push(id);
    collectCommentIds(n.replies, out);
  }
  return out;
}

/** Attach per-comment like counts and whether the viewer liked (requires community_comment_likes table). */
async function attachCommentLikes(tree, viewerId) {
  const ids = collectCommentIds(tree, []);
  if (ids.length === 0) return tree;

  let likeRows = [];
  try {
    likeRows = await fetchCommentLikesForCommentIds(ids);
  } catch {
    function walkBare(nodes) {
      return (nodes || []).map((n) => ({
        ...n,
        commentLikeCount: 0,
        commentLiked: false,
        replies: walkBare(n.replies),
      }));
    }
    return walkBare(tree);
  }

  const countBy = new Map();
  const liked = new Set();
  for (const r of likeRows) {
    const cid = String(r.comment_id);
    countBy.set(cid, (countBy.get(cid) || 0) + 1);
    if (viewerId && String(r.user_id) === String(viewerId)) liked.add(cid);
  }

  function walk(nodes) {
    return (nodes || []).map((n) => {
      const id = commentRowId(n);
      return {
        ...n,
        commentLikeCount: id ? countBy.get(id) || 0 : 0,
        commentLiked: id ? liked.has(id) : false,
        replies: walk(n.replies),
      };
    });
  }
  return walk(tree);
}

function commentParentId(c) {
  const p = c.parent_id ?? c.parentId;
  if (p == null || p === "") return null;
  return String(p);
}

function commentRowId(c) {
  return String(c.id ?? "");
}

function nestComments(flat) {
  const byId = new Map();
  for (const c of flat || []) {
    const id = commentRowId(c);
    if (!id) continue;
    byId.set(id, { ...c, id, parent_id: commentParentId(c), replies: [] });
  }
  const roots = [];
  for (const c of byId.values()) {
    const pid = commentParentId(c);
    if (pid) {
      const parent = byId.get(pid);
      if (parent) parent.replies.push(c);
      else roots.push(c);
    } else {
      roots.push(c);
    }
  }
  const sortReplies = (nodes) => {
    nodes.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    for (const n of nodes) sortReplies(n.replies || []);
  };
  sortReplies(roots);
  return roots;
}

const ROOT_PAGE_DEFAULT = 5;

/** Paginate top-level comment threads (roots), including full reply trees per root. */
async function fetchCommentRootPage(postId, limit, cursorCreatedAt, viewerId) {
  const lim = Math.min(Math.max(Number(limit) || ROOT_PAGE_DEFAULT, 1), 50);

  try {
    const rootRows = await fetchCommentRoots(postId, {
      limit: lim + 1,
      cursor: cursorCreatedAt || null,
    });

    const hasMore = rootRows.length > lim;
    const roots = hasMore ? rootRows.slice(0, lim) : rootRows;
    const rootIds = roots.map((r) => String(r.id));

    if (rootIds.length === 0) {
      return {
        comments: [],
        nextCommentCursor: null,
        hasMoreComments: false,
        error: null,
      };
    }

    const collected = new Map(roots.map((r) => [String(r.id), r]));
    let frontier = [...rootIds];
    let depth = 0;
    while (frontier.length > 0 && depth < 48) {
      depth += 1;
      const layer = await fetchCommentsByParentIds(postId, frontier);
      if (!layer?.length) break;
      const next = [];
      for (const row of layer) {
        const id = String(row.id);
        if (!collected.has(id)) {
          collected.set(id, row);
          next.push(id);
        }
      }
      frontier = next;
    }

    const flat = Array.from(collected.values());
    const nested = nestComments(flat);
    const nestedWithLikes = await attachCommentLikes(nested, viewerId);
    const nestedWithNames = await attachAuthorUsernamesToCommentTree(nestedWithLikes);
    const lastRoot = roots[roots.length - 1];
    const nextCommentCursor = hasMore && lastRoot?.created_at ? lastRoot.created_at : null;

    return {
      comments: nestedWithNames,
      nextCommentCursor,
      hasMoreComments: hasMore,
      error: null,
    };
  } catch (rErr) {
    return { error: rErr };
  }
}

export async function GET(request, { params }) {
  const user = await getSessionUser(request);

  if (!isCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  if (!isCommunityDbConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { id: postId } = await params;
  if (!postId) return fail("Missing post id", 400);

  const { searchParams } = new URL(request.url);
  const usePaging = searchParams.has("limit") || searchParams.has("cursor");

  if (usePaging) {
    const limit = searchParams.get("limit");
    const cursor = searchParams.get("cursor");
    const viewerId = user ? String(user._id) : "";
    const page = await fetchCommentRootPage(postId, limit, cursor, viewerId);
    if (page.error) {
      const message = page.error instanceof Error ? page.error.message : String(page.error);
      const mapped = mapCommunitySupabaseError(message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(message, 500);
    }
    return ok({
      comments: page.comments,
      currentUserId: user ? String(user._id) : "",
      nextCommentCursor: page.nextCommentCursor,
      hasMoreComments: page.hasMoreComments,
    });
  }

  const viewerKey = user ? String(user._id) : "anon";
  const commentsCacheKey = communityCommentsCacheKey(postId, viewerKey);
  const cached = await getRedisJSON(commentsCacheKey);
  if (cached && typeof cached === "object" && Array.isArray(cached.comments)) {
    return ok(cached);
  }

  let rows;
  try {
    rows = await fetchAllCommentsForPost(postId);
  } catch (qErr) {
    const message = qErr instanceof Error ? qErr.message : String(qErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message, 500);
  }

  const nested = nestComments(rows || []);
  const viewerId = user ? String(user._id) : "";
  const withLikes = await attachCommentLikes(nested, viewerId);
  const withNames = await attachAuthorUsernamesToCommentTree(withLikes);

  const payload = {
    comments: withNames,
    currentUserId: viewerId,
  };
  void setRedisJSON(commentsCacheKey, payload, COMMUNITY_COMMENTS_CACHE_TTL_SEC);
  return ok(payload);
}

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

  const { id: postId } = await params;
  if (!postId) return fail("Missing post id", 400);

  let body = "";
  let parentId = null;
  try {
    const json = await request.json();
    body = String(json.body || "").trim();
    const rawParent = json.parentId ?? json.parent_id;
    parentId = rawParent ? String(rawParent).trim() : null;
  } catch {
    return fail("Invalid JSON body", 400);
  }

  if (!body || body.length > 500) {
    return fail("Comment must be 1–500 characters.", 422);
  }

  let parentAuthorId = null;
  if (parentId) {
    let parent;
    try {
      parent = await findCommentWithPost(parentId);
    } catch (pErr) {
      const message = pErr instanceof Error ? pErr.message : String(pErr);
      const mapped = mapCommunitySupabaseError(message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(message, 500);
    }
    if (!parent || parent.post_id !== postId) {
      return fail("Invalid reply target.", 422);
    }
    parentAuthorId = parent.author_id != null ? String(parent.author_id) : null;
  }

  let data;
  try {
    data = await insertComment({
      post_id: postId,
      parent_id: parentId || null,
      author_id: String(user._id),
      author_name: formatUserDisplayName(user),
      body,
    });
  } catch (insErr) {
    const message = insErr instanceof Error ? insErr.message : String(insErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Failed to post comment", 500);
  }

  void insertFeedSignal({
    user_id: String(user._id),
    post_id: postId,
    event_type: "comment",
  });

  await Promise.all([invalidateCommunityEngagementCaches(), invalidateCommunityCommentsForPost(postId)]);

  const actorId = String(user._id);
  const actorName = formatUserDisplayName(user);
  const postRow = await fetchPostAuthorBody(postId).catch(() => null);
  const postOwnerId = postRow?.author_id ? String(postRow.author_id) : "";

  if (postOwnerId && actorId !== postOwnerId) {
    const base = {
      actorUserId: actorId,
      actorName,
      postId,
      postBodySnippet: postRow?.body,
      commentSnippet: body,
    };
    if (!parentId) {
      void notifyCommunityActivity({ ...base, recipientUserId: postOwnerId, kind: "comment_on_post" });
    } else if (parentAuthorId === postOwnerId) {
      void notifyCommunityActivity({ ...base, recipientUserId: postOwnerId, kind: "reply_to_comment" });
    } else {
      void notifyCommunityActivity({ ...base, recipientUserId: postOwnerId, kind: "reply_on_post" });
      if (parentAuthorId && parentAuthorId !== actorId) {
        void notifyCommunityActivity({ ...base, recipientUserId: parentAuthorId, kind: "reply_to_comment" });
      }
    }
  }

  const singleTree = await attachCommentLikes([{ ...data, replies: [] }], actorId);
  const namedTree = await attachAuthorUsernamesToCommentTree(singleTree);
  const commentPayload = namedTree[0] || { ...data, replies: [], commentLikeCount: 0, commentLiked: false };

  return ok({ comment: commentPayload });
}
