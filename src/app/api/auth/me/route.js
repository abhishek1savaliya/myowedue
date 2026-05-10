import { requireUser } from "@/lib/session";
import { fail, ok } from "@/lib/api";
import { safeUser } from "@/lib/auth";
import User from "@/models/User";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import { clearCommunityCaches, clearDashboardCache, publishNotificationEvent } from "@/lib/redis";
import { hasActivePremium } from "@/lib/subscription";

export async function GET(request) {
  const { user, error } = await requireUser(request);
  if (error) return error;
  return ok({ user: safeUser(user) });
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
    if (typeof body.showVerifiedBadge !== "boolean") {
      return fail("showVerifiedBadge must be a boolean", 422);
    }
    if (!hasActivePremium(user)) {
      return fail("An active premium subscription is required to show a verified badge.", 403);
    }

    await connectDB();
    const updated = await User.findByIdAndUpdate(
      user._id,
      { $set: { showVerifiedBadge: body.showVerifiedBadge } },
      { returnDocument: "after" }
    );
    if (!updated) return fail("User not found", 404);

    await clearCommunityCaches();

    return ok({
      user: safeUser(updated),
      showVerifiedBadge: Boolean(updated.showVerifiedBadge),
      message: "Community badge preference updated",
    });
  } catch {
    return fail("Failed to update preference", 500);
  }
}
