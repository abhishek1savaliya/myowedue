import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { maybeSendCommunityUsernamePrompt } from "@/lib/community-username-prompt";
import { requireUser } from "@/lib/session";
import Notification from "@/models/Notification";
import { COMMUNITY_POST_NOTIFICATION_TYPES } from "@/lib/community-post-notification-types";
import {
  communityPostNotificationsCacheKey,
  delRedisKey,
  getRedisJSON,
  notificationsCacheKey,
  publishNotificationEvent,
  setRedisJSON,
} from "@/lib/redis";

export async function GET(request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  void maybeSendCommunityUsernamePrompt(user).catch(() => {});

  const { searchParams } = new URL(request.url);
  const scopeCommunity =
    searchParams.get("scope") === "community" || searchParams.get("scope") === "community_posts";

  const cacheKey = scopeCommunity ? communityPostNotificationsCacheKey(user._id) : notificationsCacheKey(user._id);
  const cached = await getRedisJSON(cacheKey);
  if (cached) return ok(cached);

  try {
    await connectDB();

    const now = new Date();

    await Notification.deleteMany({ userId: user._id, expiresAt: { $lt: now } });

    if (user.notificationsEnabled === false) {
      const payload = { notifications: [], notificationCount: 0, notificationsEnabled: false };
      await setRedisJSON(cacheKey, payload, 30);
      return ok(payload);
    }

    const query = scopeCommunity
      ? { userId: user._id, type: { $in: COMMUNITY_POST_NOTIFICATION_TYPES } }
      : { userId: user._id };

    const limit = scopeCommunity ? 15 : 20;

    const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(limit).lean();

    const payload = {
      notifications,
      notificationCount: notifications.length,
      notificationsEnabled: true,
      ...(scopeCommunity ? { scope: "community" } : {}),
    };

    await setRedisJSON(cacheKey, payload, 45);
    return ok(payload);
  } catch (caughtError) {
    console.error("Notifications API error:", caughtError);
    const message =
      process.env.NODE_ENV === "development"
        ? caughtError?.message || "Failed to load notifications"
        : "Failed to load notifications";
    return fail(message, 500);
  }
}

export async function DELETE(request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return fail("Notification id is required", 422);

    await connectDB();

    const deleted = await Notification.findOneAndDelete({
      _id: id,
      userId: user._id,
    });

    if (!deleted) return fail("Notification not found", 404);

    await delRedisKey(notificationsCacheKey(user._id));
    await delRedisKey(communityPostNotificationsCacheKey(user._id));
    await publishNotificationEvent(user._id, "deleted");
    return ok({ message: "Notification deleted" });
  } catch (caughtError) {
    console.error("Notification delete error:", caughtError);
    const message =
      process.env.NODE_ENV === "development"
        ? caughtError?.message || "Failed to delete notification"
        : "Failed to delete notification";
    return fail(message, 500);
  }
}