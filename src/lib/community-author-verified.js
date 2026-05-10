import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { hasActivePremium } from "@/lib/subscription";

/** Premium + user opted in → show blue check on community posts. */
export function userShowsPublicVerifiedBadge(userDoc) {
  if (!userDoc) return false;
  return hasActivePremium(userDoc) && Boolean(userDoc.showVerifiedBadge);
}

/**
 * @param {Array<Record<string, unknown>>} posts
 * @returns {Promise<Array<Record<string, unknown> & { authorVerified: boolean }>>}
 */
export async function attachAuthorVerifiedToPosts(posts) {
  if (!posts?.length) return [];
  const rawIds = [...new Set(posts.map((p) => String(p.author_id || "").trim()).filter(Boolean))];
  if (rawIds.length === 0) {
    return posts.map((p) => ({ ...p, authorVerified: false }));
  }

  await connectDB();
  const users = await User.find({ _id: { $in: rawIds } })
    .select("isPremium subscriptionEndDate showVerifiedBadge")
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  return posts.map((p) => {
    const u = byId.get(String(p.author_id));
    return { ...p, authorVerified: userShowsPublicVerifiedBadge(u) };
  });
}
