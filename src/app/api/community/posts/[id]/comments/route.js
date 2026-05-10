import { fail, ok } from "@/lib/api";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { clearCommunityCaches, communityCommentsCacheKey, getRedisJSON, setRedisJSON } from "@/lib/redis";
import { getSessionUser, requireUser } from "@/lib/session";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";

const COMMUNITY_COMMENTS_CACHE_TTL_SEC = 60;

function displayName(user) {
  const n = String(user?.name || "").trim();
  if (n) return n;
  const f = String(user?.firstName || "").trim();
  const l = String(user?.lastName || "").trim();
  return `${f} ${l}`.trim() || "Member";
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

  const viewerId = user ? String(user._id) : "anon";
  const commentsCacheKey = communityCommentsCacheKey(postId, viewerId);
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

  const payload = {
    comments: nestComments(rows || []),
    currentUserId: user ? String(user._id) : "",
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

  if (parentId) {
    const { data: parent, error: pErr } = await supabase
      .from("community_comments")
      .select("id, post_id")
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
  }

  const { data, error: insErr } = await supabase
    .from("community_comments")
    .insert({
      post_id: postId,
      parent_id: parentId || null,
      author_id: String(user._id),
      author_name: displayName(user),
      body,
    })
    .select("id, post_id, parent_id, author_id, author_name, body, created_at")
    .single();

  if (insErr) {
    const mapped = mapCommunitySupabaseError(insErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(insErr.message || "Failed to post comment", 500);
  }

  await clearCommunityCaches();

  return ok({ comment: { ...data, replies: [] } });
}
