import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { hasActivePremium } from "@/lib/subscription";
import { fetchPostLikesForPosts, isCommunityDbConfigured } from "@/lib/community-db";

/** Pro subscribers hide their likes from everyone else (counts and liked state). */
export function hasPrivateCommunityLikes(user) {
  return hasActivePremium(user);
}

/**
 * @param {string[]} userIds
 * @returns {Promise<Set<string>>}
 */
export async function getPrivateLikeUserIdSet(userIds) {
  const uniq = [...new Set((userIds || []).map((id) => String(id)).filter(Boolean))];
  if (!uniq.length) return new Set();

  await connectDB();
  const users = await User.find({ _id: { $in: uniq } }).select("isPremium subscriptionEndDate").lean();
  const set = new Set();
  for (const u of users) {
    if (hasPrivateCommunityLikes(u)) set.add(String(u._id));
  }
  return set;
}

/**
 * @param {Array<{ post_id: string; user_id: string }>} likesRows
 * @param {Array<{ post_id: string }>} commentRows
 * @param {string} currentUserId
 * @param {Set<string>} privateLikerIds
 */
export function aggregateEngagementWithPrivateLikes(likesRows, commentRows, currentUserId, privateLikerIds) {
  const privateSet = privateLikerIds instanceof Set ? privateLikerIds : new Set();
  const viewerId = currentUserId ? String(currentUserId) : "";
  const likeCount = {};
  const commentCount = {};
  const likedByMe = new Set();

  for (const row of likesRows || []) {
    const likerId = String(row.user_id);
    const isPrivate = privateSet.has(likerId);
    if (isPrivate && likerId !== viewerId) continue;
    likeCount[row.post_id] = (likeCount[row.post_id] || 0) + 1;
    if (likerId === viewerId) likedByMe.add(row.post_id);
  }

  for (const row of commentRows || []) {
    commentCount[row.post_id] = (commentCount[row.post_id] || 0) + 1;
  }

  return { likeCount, commentCount, likedByMe };
}

/**
 * @param {Array<{ post_id: string; user_id?: string }>} likeRows
 * @param {string} viewerUserId
 * @param {Set<string>} [privateLikerIds]
 */
export async function buildPublicLikesMap(likeRows, viewerUserId, privateLikerIds) {
  const rows = likeRows || [];
  const privateSet =
    privateLikerIds instanceof Set
      ? privateLikerIds
      : await getPrivateLikeUserIdSet(rows.map((r) => r.user_id).filter(Boolean));
  const viewerId = viewerUserId ? String(viewerUserId) : "";
  const map = new Map();

  for (const r of rows) {
    if (!r.user_id) {
      map.set(r.post_id, (map.get(r.post_id) || 0) + 1);
      continue;
    }
    const likerId = String(r.user_id);
    if (privateSet.has(likerId) && likerId !== viewerId) continue;
    map.set(r.post_id, (map.get(r.post_id) || 0) + 1);
  }

  return map;
}

/**
 * @param {string} postId
 * @param {string} viewerUserId
 */
export async function countPublicPostLikes(postId, viewerUserId) {
  if (!isCommunityDbConfigured()) {
    throw new Error("Community database not configured");
  }
  const rows = await fetchPostLikesForPosts([postId]);
  const privateSet = await getPrivateLikeUserIdSet((rows || []).map((r) => r.user_id));
  const viewerId = viewerUserId ? String(viewerUserId) : "";
  let count = 0;
  for (const row of rows || []) {
    const likerId = String(row.user_id);
    if (privateSet.has(likerId) && likerId !== viewerId) continue;
    count += 1;
  }
  return count;
}

export function communityViewerPayload(sessionUser) {
  if (!sessionUser) return null;
  const isPremium = hasActivePremium(sessionUser);
  return {
    isPremium,
    privateLikesEnabled: isPremium,
    showVerifiedBadge: Boolean(sessionUser.showVerifiedBadge),
  };
}
