import { fail, ok } from "@/lib/api";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { normalizeSavedUsernameHandle, tryNormalizeCommunityUsername } from "@/lib/community-usernames";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { getSessionUser } from "@/lib/session";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";
import { hasActivePremium } from "@/lib/subscription";

/**
 * Public profile posts feed. Visible without login only when profile is public.
 */
export async function GET(request, { params }) {
  const { username: raw } = await params;
  const segment = String(raw ?? "").trim();
  const normalized = normalizeSavedUsernameHandle(segment.replace(/^@+/, ""));
  if (!normalized) return fail("Invalid username.", 422);

  const parsed = tryNormalizeCommunityUsername(normalized);
  if (!parsed.ok) return fail("Profile not found.", 404);

  if (!isSupabaseCommunityConfigured()) return fail("Community unavailable.", 503);
  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const supabase = getSupabaseAdmin();
  if (!supabase) return fail("Community unavailable.", 503);

  const { data: rowExact, error: qErr } = await supabase
    .from("community_usernames")
    .select("user_id")
    .eq("username", parsed.normalized)
    .maybeSingle();
  if (qErr) {
    const mapped = mapCommunitySupabaseError(qErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(qErr.message || "Lookup failed", 500);
  }
  let row = rowExact;
  if (!row?.user_id) {
    const { data: rowInsensitive, error: iErr } = await supabase
      .from("community_usernames")
      .select("user_id")
      .ilike("username", parsed.normalized)
      .maybeSingle();
    if (iErr) {
      const mapped = mapCommunitySupabaseError(iErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(iErr.message || "Lookup failed", 500);
    }
    row = rowInsensitive;
  }
  if (!row?.user_id) return fail("Profile not found.", 404);

  const profileUserId = String(row.user_id);
  const viewer = await getSessionUser(request);
  const viewerId = viewer ? String(viewer._id) : "";
  const { searchParams } = new URL(request.url);
  const rawFilter = String(searchParams.get("filter") || "all").toLowerCase();
  const filter = rawFilter === "liked" || rawFilter === "shared" ? rawFilter : "all";

  await connectDB();
  const user = await User.findById(profileUserId).select("showVerifiedBadge subscriptionEndDate isPremium communityProfileVisibility");
  if (!user) return fail("Profile not found.", 404);

  const isPrivate = user.communityProfileVisibility === "private";
  const isSelf = viewerId && viewerId === profileUserId;
  if (isPrivate && !isSelf) {
    return ok({ posts: [], currentUserId: viewerId, hidden: true });
  }

  let posts = [];
  let postsErr = null;
  if (filter === "liked" || filter === "shared") {
    const table = filter === "liked" ? "community_post_likes" : "community_post_shares";
    const { data: mapRows, error: mapErr } = await supabase
      .from(table)
      .select("post_id, created_at")
      .eq("user_id", profileUserId)
      .order("created_at", { ascending: false })
      .limit(120);
    if (mapErr) {
      const mapped = mapCommunitySupabaseError(mapErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(mapErr.message || `Failed to load ${filter}`, 500);
    }
    const ids = (mapRows || []).map((r) => r.post_id);
    if (ids.length > 0) {
      const { data: relatedPosts, error: relatedErr } = await supabase
        .from("community_posts")
        .select("id, author_id, author_name, body, share_count, created_at")
        .in("id", ids);
      if (relatedErr) {
        postsErr = relatedErr;
      } else {
        const byId = new Map((relatedPosts || []).map((p) => [p.id, p]));
        posts = ids.map((id) => byId.get(id)).filter(Boolean);
      }
    }
  } else {
    const { data, error } = await supabase
      .from("community_posts")
      .select("id, author_id, author_name, body, share_count, created_at")
      .eq("author_id", profileUserId)
      .order("created_at", { ascending: false })
      .limit(100);
    posts = data || [];
    postsErr = error;
  }
  if (postsErr) {
    const mapped = mapCommunitySupabaseError(postsErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(postsErr.message || "Failed to load posts", 500);
  }

  const postIds = (posts || []).map((p) => p.id);
  let likes = [];
  let comments = [];
  if (postIds.length > 0) {
    const [{ data: likeRows, error: likesErr }, { data: commentRows, error: commentsErr }] = await Promise.all([
      supabase.from("community_post_likes").select("post_id").in("post_id", postIds),
      supabase.from("community_comments").select("post_id").in("post_id", postIds),
    ]);
    if (likesErr) {
      const mapped = mapCommunitySupabaseError(likesErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(likesErr.message || "Failed to load likes", 500);
    }
    if (commentsErr) {
      const mapped = mapCommunitySupabaseError(commentsErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(commentsErr.message || "Failed to load comments", 500);
    }
    likes = likeRows || [];
    comments = commentRows || [];
  }

  const likeCount = {};
  const commentCount = {};
  for (const row of likes) likeCount[row.post_id] = (likeCount[row.post_id] || 0) + 1;
  for (const row of comments) commentCount[row.post_id] = (commentCount[row.post_id] || 0) + 1;

  const authorVerified = hasActivePremium(user) && Boolean(user.showVerifiedBadge);
  const payload = (posts || []).map((p) => ({
    ...p,
    author_username: parsed.normalized,
    authorVerified,
    likeCount: likeCount[p.id] || 0,
    commentCount: commentCount[p.id] || 0,
  }));

  return ok({ posts: payload, currentUserId: viewerId, hidden: false, filter });
}

