import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import User from "@/models/User";
import { clearDashboardCache } from "@/lib/redis";

export async function PUT(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { reminderFrequency, darkMode } = await request.json();

    if (reminderFrequency && !["daily", "weekly", "monthly"].includes(reminderFrequency)) {
      return fail("Invalid reminder frequency", 422);
    }

    await connectDB();
    const updated = await User.findByIdAndUpdate(
      user._id,
      {
        ...(reminderFrequency ? { reminderFrequency } : {}),
        ...(typeof darkMode === "boolean" ? { darkMode } : {}),
      },
      { returnDocument: "after" }
    );

    await clearDashboardCache(user._id);

    return ok({
      message: "Settings updated",
      user: {
        reminderFrequency: updated.reminderFrequency,
        darkMode: updated.darkMode,
      },
    });
  } catch {
    return fail("Failed to update settings", 500);
  }
}
