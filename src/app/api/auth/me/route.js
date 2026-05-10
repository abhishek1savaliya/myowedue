import { requireUser } from "@/lib/session";
import { fail, ok } from "@/lib/api";
import { safeUser } from "@/lib/auth";
import User from "@/models/User";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import { maybeSendCommunityUsernamePrompt } from "@/lib/community-username-prompt";
import {
  clearCommunityCaches,
  clearDashboardCache,
  communityPostNotificationsCacheKey,
  delRedisKey,
  notificationsCacheKey,
  publishNotificationEvent,
} from "@/lib/redis";
import { hasActivePremium } from "@/lib/subscription";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";

export async function GET(request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  const base = safeUser(user);
  let communityUsername = null;
  if (isSupabaseCommunityConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data } = await supabase.from("community_usernames").select("username").eq("user_id", String(user._id)).maybeSingle();
      communityUsername = data?.username ?? null;
    }
  }

  void maybeSendCommunityUsernamePrompt(user).catch(() => {});

  return ok({ user: { ...base, communityUsername } });
}

export async function PUT(request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  try {
    const { firstName, lastName, email, phone, notificationsEnabled } = await request.json();

    const nextFirst = String(firstName || "").trim();
    const nextLast = String(lastName || "").trim();
    const nextEmail = String(email || "").toLowerCase().trim();
    const nextPhone = String(phone || "").trim();

    if (!nextFirst || !nextLast || !nextEmail) {
      return fail("First name, last name and email are required", 422);
    }

    await connectDB();

    const duplicate = await User.findOne({
      email: nextEmail,
      _id: { $ne: user._id },
    });
    if (duplicate) {
      return fail("Email already in use", 409);
    }

    const updated = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          firstName: nextFirst,
          lastName: nextLast,
          name: `${nextFirst} ${nextLast}`.trim(),
          email: nextEmail,
          phone: nextPhone,
          ...(typeof notificationsEnabled === "boolean" ? { notificationsEnabled } : {}),
        },
      },
      { returnDocument: "after" }
    );

    if (!updated) return fail("User not found", 404);

    if (typeof notificationsEnabled === "boolean" && notificationsEnabled === false) {
      await Notification.deleteMany({ userId: user._id });
      await delRedisKey(notificationsCacheKey(user._id));
      await delRedisKey(communityPostNotificationsCacheKey(user._id));
      await publishNotificationEvent(user._id, "cleared");
    }

    await clearDashboardCache(user._id);

    return ok({ user: safeUser(updated), message: "Profile updated" });
  } catch {
    return fail("Failed to update profile", 500);
  }
}

/** Toggle public verified badge on community posts (premium only). */
export async function PATCH(request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  try {
    const body = await request.json();
    const hasBadgeUpdate = typeof body.showVerifiedBadge === "boolean";
    const hasVisibilityUpdate = typeof body.communityProfileVisibility === "string";
    if (!hasBadgeUpdate && !hasVisibilityUpdate) {
      return fail("No valid preference updates provided.", 422);
    }

    if (hasBadgeUpdate && !hasActivePremium(user)) {
      return fail("An active premium subscription is required to show a verified badge.", 403);
    }

    let nextVisibility;
    if (hasVisibilityUpdate) {
      const normalizedVisibility = String(body.communityProfileVisibility || "").trim().toLowerCase();
      if (normalizedVisibility !== "public" && normalizedVisibility !== "private") {
        return fail("communityProfileVisibility must be 'public' or 'private'.", 422);
      }
      nextVisibility = normalizedVisibility;
    }

    await connectDB();
    const updates = {};
    if (hasBadgeUpdate) updates.showVerifiedBadge = body.showVerifiedBadge;
    if (nextVisibility) updates.communityProfileVisibility = nextVisibility;

    const updated = await User.findByIdAndUpdate(
      user._id,
      { $set: updates },
      { returnDocument: "after" }
    );
    if (!updated) return fail("User not found", 404);

    await clearCommunityCaches();

    return ok({
      user: safeUser(updated),
      showVerifiedBadge: Boolean(updated.showVerifiedBadge),
      communityProfileVisibility: updated.communityProfileVisibility === "private" ? "private" : "public",
      message: "Community preferences updated",
    });
  } catch {
    return fail("Failed to update preference", 500);
  }
}
