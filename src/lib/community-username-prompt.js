import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import User from "@/models/User";
import { findUsernameByUserId } from "@/lib/community-db";
import { prepareCommunityApi } from "@/lib/community-api-setup";
import { isCommunityConfigured } from "@/lib/community-server";
import { communityPostNotificationsCacheKey, delRedisKey, notificationsCacheKey, publishNotificationEvent } from "@/lib/redis";

const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * One-time in-app reminder for accounts without a community @username (SQL table).
 * Safe to call from GET /api/auth/me or GET /api/notifications.
 */
export async function maybeSendCommunityUsernamePrompt(user) {
  if (!user?._id) return;
  if (user.notificationsEnabled === false) return;

  if (!isCommunityConfigured()) return;

  const { fail503 } = await prepareCommunityApi();
  if (fail503) return;

  const uid = String(user._id);

  try {
    const row = await findUsernameByUserId(uid);
    if (row?.user_id) {
      await connectDB();
      await User.updateOne(
        { _id: user._id, communityUsernamePromptSent: { $ne: true } },
        { $set: { communityUsernamePromptSent: true } }
      ).catch(() => {});
      return;
    }
  } catch {
    return;
  }

  try {
    await connectDB();

    const result = await User.updateOne(
      {
        _id: user._id,
        $or: [{ communityUsernamePromptSent: false }, { communityUsernamePromptSent: { $exists: false } }],
      },
      { $set: { communityUsernamePromptSent: true } }
    );

    if (!result.modifiedCount) return;

    const expiresAt = new Date(Date.now() + RETENTION_MS);
    await Notification.create({
      userId: user._id,
      type: "community_username_prompt",
      title: "Choose your community username",
      message:
        "Add a unique @username for Community — open Settings → Profile or Community settings. It appears next to your display name on posts and replies.",
      meta: { source: "community_username_prompt" },
      expiresAt,
    });

    await delRedisKey(notificationsCacheKey(uid));
    await delRedisKey(communityPostNotificationsCacheKey(uid));
    await publishNotificationEvent(uid, "created").catch(() => {});
  } catch (err) {
    console.error("[community-username-prompt]", err?.message || err);
  }
}
