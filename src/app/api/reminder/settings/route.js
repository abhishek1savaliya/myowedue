import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import User from "@/models/User";
import { clearDashboardCache } from "@/lib/redis";
import {
  DEFAULT_FONT_PRESET,
  DEFAULT_FONT_SIZE_PRESET,
  isValidFontPreset,
  isValidFontSizePreset,
} from "@/lib/appearance";
import { hasActivePremium } from "@/lib/subscription";

export async function PUT(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { reminderFrequency, darkMode, fontPreset, fontSizePreset } = await request.json();

    if (reminderFrequency && !["daily", "weekly", "monthly"].includes(reminderFrequency)) {
      return fail("Invalid reminder frequency", 422);
    }
    if (fontPreset && !isValidFontPreset(fontPreset)) {
      return fail("Invalid font preset", 422);
    }
    if (fontSizePreset && !isValidFontSizePreset(fontSizePreset)) {
      return fail("Invalid font size preset", 422);
    }

    const premiumUser = hasActivePremium(user);
    if ((fontPreset || fontSizePreset) && !premiumUser) {
      return fail("Premium subscription required for typography controls", 403);
    }

    await connectDB();
    const updated = await User.findByIdAndUpdate(
      user._id,
      {
        ...(reminderFrequency ? { reminderFrequency } : {}),
        ...(typeof darkMode === "boolean" ? { darkMode } : {}),
        ...(premiumUser
          ? {
              fontPreset: fontPreset || user.fontPreset || DEFAULT_FONT_PRESET,
              fontSizePreset: fontSizePreset || user.fontSizePreset || DEFAULT_FONT_SIZE_PRESET,
            }
          : {}),
      },
      { returnDocument: "after" }
    );

    await clearDashboardCache(user._id);

    return ok({
      message: "Settings updated",
      user: {
        reminderFrequency: updated.reminderFrequency,
        darkMode: updated.darkMode,
        fontPreset: updated.fontPreset || DEFAULT_FONT_PRESET,
        fontSizePreset: updated.fontSizePreset || DEFAULT_FONT_SIZE_PRESET,
      },
    });
  } catch {
    return fail("Failed to update settings", 500);
  }
}
