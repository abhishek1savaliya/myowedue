import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import User from "@/models/User";
import { communityPostNotificationsCacheKey, delRedisKey, notificationsCacheKey, publishNotificationEvent } from "@/lib/redis";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Display name for Mongo session user (community APIs). */
export function formatUserDisplayName(user) {
  const n = String(user?.name || "").trim();
  if (n) return n;
  const f = String(user?.firstName || "").trim();
  const l = String(user?.lastName || "").trim();
  return `${f} ${l}`.trim() || "Member";
}

function clip(s, n) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

function isValidRecipientId(id) {
  const s = String(id || "");
  if (!s || !mongoose.Types.ObjectId.isValid(s)) return false;
  return String(new mongoose.Types.ObjectId(s)) === s;
}

/**
 * @param {{
 *   recipientUserId: string;
 *   actorUserId?: string;
 *   actorName?: string;
 *   kind: "post_like" | "post_share" | "comment_on_post" | "reply_on_post" | "reply_to_comment" | "comment_like";
 *   postId: string;
 *   postBodySnippet?: string;
 *   commentSnippet?: string;
 *   metaExtra?: Record<string, unknown>;
 * }} p
 */
export async function notifyCommunityActivity(p) {
  const recipientUserId = String(p.recipientUserId || "");
  const actorUserId = String(p.actorUserId || "");
  const actorName = clip(p.actorName, 80) || "Someone";

  if (!isValidRecipientId(recipientUserId)) return;
  if (actorUserId && recipientUserId === actorUserId) return;

  try {
    await connectDB();
    const u = await User.findById(recipientUserId).select("notificationsEnabled").lean();
    if (!u || u.notificationsEnabled === false) return;

    const postSnippet = clip(p.postBodySnippet, 100);
    const commentSnippet = clip(p.commentSnippet, 120);

    let type;
    let title;
    let message;

    switch (p.kind) {
      case "post_like":
        type = "community_post_like";
        title = "New like on your post";
        message = postSnippet
          ? `${actorName} liked your post: "${postSnippet}"`
          : `${actorName} liked your post.`;
        break;
      case "post_share":
        type = "community_post_share";
        title = "Your post was shared";
        message = postSnippet
          ? `${actorName} shared your post: "${postSnippet}"`
          : `${actorName} shared your post.`;
        break;
      case "comment_on_post":
        type = "community_post_comment";
        title = "New comment";
        message = commentSnippet
          ? `${actorName} commented: "${commentSnippet}"`
          : `${actorName} commented on your post.`;
        break;
      case "reply_on_post":
        type = "community_post_comment";
        title = "New reply on your post";
        message = commentSnippet
          ? `${actorName} replied: "${commentSnippet}"`
          : `${actorName} replied on your post.`;
        break;
      case "reply_to_comment":
        type = "community_comment_reply";
        title = "Reply to your comment";
        message = commentSnippet
          ? `${actorName} replied: "${commentSnippet}"`
          : `${actorName} replied to your comment.`;
        break;
      case "comment_like":
        type = "community_comment_like";
        title = "New like on your comment";
        message = commentSnippet
          ? `${actorName} liked your comment: "${commentSnippet}"`
          : `${actorName} liked your comment.`;
        break;
      default:
        return;
    }

    const meta = {
      postId: String(p.postId),
      communityKind: p.kind,
      ...(p.metaExtra && typeof p.metaExtra === "object" ? p.metaExtra : {}),
    };

    const expiresAt = new Date(Date.now() + RETENTION_MS);
    await Notification.create({
      userId: recipientUserId,
      type,
      title,
      message,
      meta,
      expiresAt,
    });

    await delRedisKey(notificationsCacheKey(recipientUserId));
    await delRedisKey(communityPostNotificationsCacheKey(recipientUserId));
    await publishNotificationEvent(recipientUserId, "created").catch(() => {});
  } catch (err) {
    console.error("[community-notifications]", err?.message || err);
  }
}
