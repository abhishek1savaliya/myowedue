import { fail, ok } from "@/lib/api";
import { notifyCommunityActivity } from "@/lib/community-notifications";
import { formatUserDisplayName } from "@/lib/format-user-display-name";
import { attachAuthorUsernamesToCommentTree } from "@/lib/community-usernames";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { clearCommunityCaches, communityCommentsCacheKey, getRedisJSON, setRedisJSON } from "@/lib/redis";
import { getSessionUser, requireUser } from "@/lib/session";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";

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
async function attachCommentLikes(supabase, tree, viewerId) {
  const ids = collectCommentIds(tree, []);
  if (ids.length === 0) return tree;

  const { data: likeRows, error: likeErr } = await supabase
    .from("community_comment_likes")
    .select("comment_id, user_id")
    .in("comment_id", ids);

  if (likeErr || !likeRows) {
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
async function fetchCommentRootPage(supabase, postId, limit, cursorCreatedAt, viewerId) {
  const lim = Math.min(Math.max(Number(limit) || ROOT_PAGE_DEFAULT, 1), 50);
  const pageSize = lim + 1;

  let rootsQuery = supabase
    .from("community_comments")
    .select("id, post_id, parent_id, author_id, author_name, body, created_at")
    .eq("post_id", postId)
    .is("parent_id", null)
    .order("created_at", { ascending: true })
    .limit(pageSize);

  if (cursorCreatedAt) {
    const d = new Date(String(cursorCreatedAt));
    if (!Number.isNaN(d.getTime())) {
      rootsQuery = rootsQuery.gt("created_at", d.toISOString());
    }
  }

  const { data: rootRows, error: rErr } = await rootsQuery;
  if (rErr) return { error: rErr };

  const slice = rootRows || [];
  const hasMore = slice.length > lim;
  const roots = hasMore ? slice.slice(0, lim) : slice;
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
    const { data: layer, error: lErr } = await supabase
      .from("community_comments")
      .select("id, post_id, parent_id, author_id, author_name, body, created_at")
      .eq("post_id", postId)
      .in("parent_id", frontier);
    if (lErr) return { error: lErr };
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
  const nestedWithLikes = await attachCommentLikes(supabase, nested, viewerId);
  const nestedWithNames = await attachAuthorUsernamesToCommentTree(supabase, nestedWithLikes);
  const lastRoot = roots[roots.length - 1];
  const nextCommentCursor = hasMore && lastRoot?.created_at ? lastRoot.created_at : null;

  return {
    comments: nestedWithNames,
    nextCommentCursor,
    hasMoreComments: hasMore,
    error: null,
  };
}

export async function GET(request, { params }) {
  const user = await getSessionUser(request);

  if (!isSupabaseCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const supabase = getSupabaseAdmin();
  if (!supabase) return fail("Community database is not configured.", 503);

  const { id: postId } = await params;
  if (!postId) return fail("Missing post id", 400);

  const { searchParams } = new URL(request.url);
  const usePaging = searchParams.has("limit") || searchParams.has("cursor");

  if (usePaging) {
    const limit = searchParams.get("limit");
    const cursor = searchParams.get("cursor");
    const viewerId = user ? String(user._id) : "";
    const page = await fetchCommentRootPage(supabase, postId, limit, cursor, viewerId);
    if (page.error) {
      const mapped = mapCommunitySupabaseError(page.error.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(page.error.message, 500);
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

  const { data: rows, error: qErr } = await supabase
    .from("community_comments")
    .select("id, post_id, parent_id, author_id, author_name, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (qErr) {
    const mapped = mapCommunitySupabaseError(qErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(qErr.message, 500);
  }

  const nested = nestComments(rows || []);
  const viewerId = user ? String(user._id) : "";
  const withLikes = await attachCommentLikes(supabase, nested, viewerId);
  const withNames = await attachAuthorUsernamesToCommentTree(supabase, withLikes);

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

  if (!isSupabaseCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const supabase = getSupabaseAdmin();
  if (!supabase) return fail("Community database is not configured.", 503);

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
    const { data: parent, error: pErr } = await supabase
      .from("community_comments")
      .select("id, post_id, author_id")
      .eq("id", parentId)
      .maybeSingle();
    if (pErr) {
      const mapped = mapCommunitySupabaseError(pErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(pErr.message, 500);
    }
    if (!parent || parent.post_id !== postId) {
      return fail("Invalid reply target.", 422);
    }
    parentAuthorId = parent.author_id != null ? String(parent.author_id) : null;
  }

  const { data, error: insErr } = await supabase
    .from("community_comments")
    .insert({
      post_id: postId,
      parent_id: parentId || null,
      author_id: String(user._id),
      author_name: formatUserDisplayName(user),
      body,
    })
    .select("id, post_id, parent_id, author_id, author_name, body, created_at")
    .single();

  if (insErr) {
    const mapped = mapCommunitySupabaseError(insErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(insErr.message || "Failed to post comment", 500);
  }

  void supabase.from("community_feed_signals").insert({
    user_id: String(user._id),
    post_id: postId,
    event_type: "comment",
    watch_time_ms: 0,
    scroll_duration_ms: 0,
    dwell_ms: 0,
  });

  await clearCommunityCaches();

  const actorId = String(user._id);
  const actorName = formatUserDisplayName(user);
  const { data: postRow } = await supabase.from("community_posts").select("author_id, body").eq("id", postId).maybeSingle();
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

  const singleTree = await attachCommentLikes(supabase, [{ ...data, replies: [] }], actorId);
  const namedTree = await attachAuthorUsernamesToCommentTree(supabase, singleTree);
  const commentPayload = namedTree[0] || { ...data, replies: [], commentLikeCount: 0, commentLiked: false };

  return ok({ comment: commentPayload });
}
