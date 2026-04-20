import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { connectDB } from "@/lib/db";
import CMSAuditLog from "@/models/CMSAuditLog";
import { normalizeCmsRole } from "@/lib/cms";

export const runtime = "nodejs";

export async function GET(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  if (normalizeCmsRole(user) !== "super_admin") {
    return fail("Forbidden", 403);
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(10, Number(searchParams.get("limit") || 50)));

    await connectDB();

    const logs = await CMSAuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("actorUserId", "name email")
      .populate("targetUserId", "name email")
      .lean();

    return ok({
      logs: logs.map((log) => ({
        id: log._id.toString(),
        action: log.action,
        pageKey: log.pageKey,
        actorRole: log.actorRole,
        actor: {
          id: log.actorUserId?._id?.toString?.() || "",
          name: log.actorUserId?.name || "Unknown",
          email: log.actorUserId?.email || "",
        },
        target: log.targetUserId
          ? {
              id: log.targetUserId?._id?.toString?.() || "",
              name: log.targetUserId?.name || "Unknown",
              email: log.targetUserId?.email || "",
            }
          : null,
        detail: log.detail || "",
        diff: log.diff || [],
        previousContent: log.previousContent,
        updatedContent: log.updatedContent,
        createdAt: log.createdAt,
      })),
    });
  } catch (caughtError) {
    console.error("CMS audit fetch error:", caughtError);
    return fail("Failed to load audit log", 500);
  }
}
