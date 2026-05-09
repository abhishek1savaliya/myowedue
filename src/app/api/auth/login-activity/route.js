import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireUser, enforceConcurrentSessionLimit, formatIpForDisplay } from "@/lib/session";
import User from "@/models/User";
import UserSession from "@/models/UserSession";

function normalizeLimit(value) {
  return Math.min(5, Math.max(1, Number(value || 1)));
}

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    await connectDB();
    const dbUser = await User.findById(user._id).select("concurrentSessionLimit").lean();
    const limit = normalizeLimit(dbUser?.concurrentSessionLimit || 1);
    const sessions = await UserSession.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("sessionId ip userAgent status createdAt revokedAt revokeReason")
      .lean();

    return ok({
      concurrentSessionLimit: limit,
      recentLogins: sessions.map((session) => ({
        sessionId: session.sessionId,
        ip: formatIpForDisplay(session.ip),
        userAgent: session.userAgent || "",
        status: session.status,
        createdAt: session.createdAt,
        revokedAt: session.revokedAt || null,
        revokeReason: session.revokeReason || "",
      })),
    });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to load login activity", 500);
  }
}

export async function PUT(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const limit = normalizeLimit(body.concurrentSessionLimit);
    await connectDB();

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: { concurrentSessionLimit: limit } },
      { returnDocument: "after" }
    ).select("concurrentSessionLimit");
    if (!updatedUser) return fail("User not found", 404);

    await enforceConcurrentSessionLimit(user._id, limit);

    return ok({ concurrentSessionLimit: normalizeLimit(updatedUser.concurrentSessionLimit), message: "Concurrent device limit updated" });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to update login activity settings", 500);
  }
}

