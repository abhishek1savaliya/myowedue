import { fail, ok } from "@/lib/api";
import { attachAuthorVerifiedToPosts } from "@/lib/community-author-verified";
import { attachAuthorUsernamesToPosts } from "@/lib/community-usernames";
import { isCommunityPostEditWindowOpen } from "@/lib/community-post-edit-window";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { extractPostTopics } from "@/lib/post-topic-extraction";
import { persistCommunityPostSeo, revalidateCommunityPostSeo } from "@/lib/community-post-seo";
import { clearCommunityCaches } from "@/lib/redis";
import { getSessionUser, requireUser } from "@/lib/session";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";

function aggregateEngagement(likesRows, commentRows, currentUserId) {
  const likeCount = {};
  const commentCount = {};
  const likedByMe = new Set();
  for (const row of likesRows || []) {
    likeCount[row.post_id] = (likeCount[row.post_id] || 0) + 1;
    if (String(row.user_id) === String(currentUserId)) likedByMe.add(row.post_id);
  }
  for (const row of commentRows || []) {
    commentCount[row.post_id] = (commentCount[row.post_id] || 0) + 1;
  }
  return { likeCount, commentCount, likedByMe };
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

  const currentUserId = user ? String(user._id) : "";

  const { data: row, error: qErr } = await supabase
    .from("community_posts")
    .select("id, author_id, author_name, body, share_count, created_at, updated_at")
    .eq("id", postId)
    .maybeSingle();

  if (qErr) {
    const mapped = mapCommunitySupabaseError(qErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(qErr.message || "Failed to load post", 500);
  }
  if (!row) return fail("Post not found", 404);

  const [likesRes, commentsRes] = await Promise.all([
    supabase.from("community_post_likes").select("post_id, user_id").eq("post_id", postId),
    supabase.from("community_comments").select("post_id").eq("post_id", postId),
  ]);

  if (likesRes.error) {
    const mapped = mapCommunitySupabaseError(likesRes.error.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(likesRes.error.message, 500);
  }
  if (commentsRes.error) {
    const mapped = mapCommunitySupabaseError(commentsRes.error.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(commentsRes.error.message, 500);
  }

  const { likeCount, commentCount, likedByMe } = aggregateEngagement(likesRes.data, commentsRes.data, currentUserId);
  const base = {
    ...row,
    likeCount: likeCount[row.id] || 0,
    commentCount: commentCount[row.id] || 0,
    liked: likedByMe.has(row.id),
  };
  const [verified] = await attachAuthorVerifiedToPosts([base]);
  const [post] = await attachAuthorUsernamesToPosts(supabase, [verified]);

  return ok({ post, currentUserId });
}

export async function PATCH(request, { params }) {
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
  try {
    const json = await request.json();
    body = String(json.body || "").trim();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  if (!body || body.length > 280) {
    return fail("Post must be 1–280 characters.", 422);
  }

  const { data: row, error: qErr } = await supabase
    .from("community_posts")
    .select("id, author_id, created_at")
    .eq("id", postId)
    .maybeSingle();

  if (qErr) {
    const mapped = mapCommunitySupabaseError(qErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(qErr.message || "Failed to load post", 500);
  }
  if (!row) return fail("Post not found", 404);

  if (String(row.author_id) !== String(user._id)) {
    return fail("You can only edit your own posts.", 403);
  }

  if (!isCommunityPostEditWindowOpen(row.created_at)) {
    return fail("You can only edit a post within 5 minutes of posting.", 403);
  }

  const updatedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("community_posts")
    .update({ body, updated_at: updatedAt })
    .eq("id", postId);

  if (updErr) {
    const mapped = mapCommunitySupabaseError(updErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(updErr.message || "Failed to update post", 500);
  }

  const { error: delTopicsErr } = await supabase.from("post_topics").delete().eq("post_id", postId);
  if (delTopicsErr) {
    const msg = String(delTopicsErr.message || "").toLowerCase();
    const missing = msg.includes("post_topics") && (msg.includes("does not exist") || msg.includes("schema"));
    if (!missing) console.warn("[community] post_topics delete:", delTopicsErr.message);
  }

  const topics = extractPostTopics(body);
  if (topics.length > 0) {
    const topicRows = topics.map((topic) => ({ post_id: postId, topic }));
    const { error: topicErr } = await supabase.from("post_topics").insert(topicRows);
    if (topicErr) {
      const msg = String(topicErr.message || "").toLowerCase();
      const missing = msg.includes("post_topics") && (msg.includes("does not exist") || msg.includes("schema"));
      if (!missing) console.warn("[community] post_topics insert:", topicErr.message);
    }
  }

  await clearCommunityCaches();

  const currentUserId = String(user._id);
  const { data: fresh, error: freshErr } = await supabase
    .from("community_posts")
    .select("id, author_id, author_name, body, share_count, created_at, updated_at")
    .eq("id", postId)
    .maybeSingle();

  if (freshErr || !fresh) {
    return fail("Post updated but could not reload.", 500);
  }

  const [likesRes, commentsRes] = await Promise.all([
    supabase.from("community_post_likes").select("post_id, user_id").eq("post_id", postId),
    supabase.from("community_comments").select("post_id").eq("post_id", postId),
  ]);

  if (likesRes.error) {
    const mapped = mapCommunitySupabaseError(likesRes.error.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(likesRes.error.message, 500);
  }
  if (commentsRes.error) {
    const mapped = mapCommunitySupabaseError(commentsRes.error.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(commentsRes.error.message, 500);
  }

  const { likeCount, commentCount, likedByMe } = aggregateEngagement(likesRes.data, commentsRes.data, currentUserId);
  const base = {
    ...fresh,
    likeCount: likeCount[fresh.id] || 0,
    commentCount: commentCount[fresh.id] || 0,
    liked: likedByMe.has(fresh.id),
  };
  const [verified] = await attachAuthorVerifiedToPosts([base]);
  const [post] = await attachAuthorUsernamesToPosts(supabase, [verified]);

  void persistCommunityPostSeo(supabase, postId, fresh).then(() => {
    revalidateCommunityPostSeo(postId);
  });

  return ok({ post });
}

export async function DELETE(request, { params }) {
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

  const { data: row, error: qErr } = await supabase
    .from("community_posts")
    .select("id, author_id")
    .eq("id", postId)
    .maybeSingle();

  if (qErr) {
    const mapped = mapCommunitySupabaseError(qErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(qErr.message || "Failed to load post", 500);
  }
  if (!row) return fail("Post not found", 404);

  if (String(row.author_id) !== String(user._id)) {
    return fail("You can only delete your own posts.", 403);
  }

  const { error: delErr } = await supabase.from("community_posts").delete().eq("id", postId);
  if (delErr) {
    const mapped = mapCommunitySupabaseError(delErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(delErr.message || "Failed to delete post", 500);
  }

  await clearCommunityCaches();
  revalidateCommunityPostSeo(postId);
  return ok({ ok: true });
}
