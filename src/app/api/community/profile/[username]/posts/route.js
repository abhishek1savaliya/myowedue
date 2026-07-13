import { fail, ok } from "@/lib/api";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { normalizeSavedUsernameHandle, tryNormalizeCommunityUsername } from "@/lib/community-usernames";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { getSessionUser } from "@/lib/session";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";
import {
  fetchCommentCountsForPosts,
  fetchPostLikesByUser,
  fetchPostLikesForPosts,
  fetchPostsByIds,
  isCommunityDbConfigured,
  listPosts,
} from "@/lib/community-db";
import { hasActivePremium } from "@/lib/subscription";
import { COMMUNITY_POST_LIST_SELECT } from "@/lib/community-post-edit-window";
import { buildPublicLikesMap, getPrivateLikeUserIdSet } from "@/lib/community-private-likes";

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
  if (filter === "liked") {
    try {
      if (!isCommunityDbConfigured()) return fail("Community unavailable.", 503);
      const mapRows = await fetchPostLikesByUser(profileUserId, { limit: 120 });
      const ids = mapRows.map((r) => r.post_id);
      if (ids.length > 0) {
        const relatedPosts = await fetchPostsByIds(ids);
        const byId = new Map((relatedPosts || []).map((p) => [p.id, p]));
        posts = ids.map((id) => byId.get(id)).filter(Boolean);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const mapped = mapCommunitySupabaseError(message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(message || "Failed to load liked", 500);
    }
  } else if (filter === "shared") {
    const table = "community_post_shares";
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
      const relatedPosts = isCommunityDbConfigured()
        ? await fetchPostsByIds(ids)
        : (
            await supabase.from("community_posts").select(COMMUNITY_POST_LIST_SELECT).in("id", ids)
          ).data;
      const byId = new Map((relatedPosts || []).map((p) => [p.id, p]));
      posts = ids.map((id) => byId.get(id)).filter(Boolean);
    }
  } else {
    try {
      if (!isCommunityDbConfigured()) return fail("Community unavailable.", 503);
      posts = await listPosts({ limit: 100, authorId: profileUserId });
    } catch (err) {
      postsErr = err;
    }
  }
  if (postsErr) {
    const message = postsErr instanceof Error ? postsErr.message : String(postsErr?.message || postsErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Failed to load posts", 500);
  }

  const postIds = (posts || []).map((p) => p.id);
  let likes = [];
  let comments = [];
  if (postIds.length > 0) {
    try {
      if (!isCommunityDbConfigured()) return fail("Community unavailable.", 503);
      [likes, comments] = await Promise.all([
        fetchPostLikesForPosts(postIds),
        fetchCommentCountsForPosts(postIds),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const mapped = mapCommunitySupabaseError(message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(message || "Failed to load likes", 500);
    }
  }

  const privateLikerIds = await getPrivateLikeUserIdSet(likes.map((r) => r.user_id));
  const likesMap = await buildPublicLikesMap(likes, viewerId, privateLikerIds);
  const commentCount = {};
  for (const row of comments) commentCount[row.post_id] = (commentCount[row.post_id] || 0) + 1;

  const authorVerified = hasActivePremium(user) && Boolean(user.showVerifiedBadge);
  const payload = (posts || []).map((p) => ({
    ...p,
    author_username: parsed.normalized,
    authorVerified,
    likeCount: likesMap.get(p.id) || 0,
    commentCount: commentCount[p.id] || 0,
  }));

  return ok({ posts: payload, currentUserId: viewerId, hidden: false, filter });
}

