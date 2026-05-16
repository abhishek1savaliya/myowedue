import { connectDB } from "@/lib/db";
import User from "@/models/User";
import {
  resolvePublicDisplayName,
  resolvePublicUsernameLabel,
} from "@/lib/community-profile-privacy";
import { attachAuthorUsernamesToPosts } from "@/lib/community-usernames";

/**
 * Apply privacy-aware display names and @labels to posts for a viewer.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {Array<object>} posts
 * @param {string | null} viewerUserId
 */
export async function attachPrivacyAwareAuthorLabels(supabase, posts, viewerUserId) {
  if (!Array.isArray(posts) || posts.length === 0) return posts;

  const authorIds = [...new Set(posts.map((p) => String(p.author_id)).filter(Boolean))];
  if (authorIds.length === 0) return posts;

  await connectDB();
  const users = await User.find({ _id: { $in: authorIds } })
    .select(
      "name firstName lastName communityPublicName communityPublicNameEnabled communityPublicUsername communityPublicUsernameEnabled"
    )
    .lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));

  const withUsernames = await attachAuthorUsernamesToPosts(supabase, posts);
  const usernameByPostId = new Map(withUsernames.map((p) => [p.id, p.author_username]));

  return posts.map((p) => {
    const uid = String(p.author_id);
    const user = userById.get(uid);
    const isSelf = viewerUserId && uid === String(viewerUserId);
    const realHandle = usernameByPostId.get(p.id) || p.author_username || null;
    if (!user) return p;
    return {
      ...p,
      author_name: resolvePublicDisplayName(user, { isSelf }),
      author_username: resolvePublicUsernameLabel(realHandle, user, { isSelf }) || p.author_username,
    };
  });
}
