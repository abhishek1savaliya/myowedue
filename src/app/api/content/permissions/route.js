import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import {
  canManagePermissions,
  createCmsAuditLog,
  normalizeCmsRole,
} from "@/lib/cms";

export const runtime = "nodejs";

function toResponseUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    cmsRole: user.cmsRole || "manager",
    contentEditPermission: Boolean(user.contentEditPermission),
    contentManagerId: user.contentManagerId?.toString?.() || null,
  };
}

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  if (!canManagePermissions(user)) {
    return fail("Forbidden", 403);
  }

  try {
    await connectDB();

    const role = normalizeCmsRole(user);
    const query = role === "super_admin"
      ? {}
      : {
          cmsRole: "team_member",
          $or: [{ contentManagerId: user._id }, { contentManagerId: null }],
        };

    const users = await User.find(query).select("name email cmsRole contentEditPermission contentManagerId").sort({ name: 1 }).lean();

    return ok({
      users: users.map(toResponseUser),
      teamMembers: users.filter((item) => item.cmsRole === "team_member").map(toResponseUser),
    });
  } catch (caughtError) {
    console.error("CMS permissions GET error:", caughtError);
    return fail("Failed to load permissions", 500);
  }
}

export async function PATCH(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  if (!canManagePermissions(user)) {
    return fail("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const targetUserId = String(body?.userId || "").trim();

    if (!targetUserId) {
      return fail("userId is required", 422);
    }

    await connectDB();

    const target = await User.findById(targetUserId);
    if (!target) return fail("User not found", 404);

    const actorRole = normalizeCmsRole(user);

    if (actorRole === "manager") {
      if (target.cmsRole !== "team_member") {
        return fail("Managers can only manage team member permissions", 422);
      }
      const managerId = target.contentManagerId?.toString?.();
      if (managerId && managerId !== user._id.toString()) {
        return fail("Forbidden", 403);
      }
      target.contentManagerId = user._id;
      target.contentEditPermission = Boolean(body?.contentEditPermission);
    } else {
      if (body?.cmsRole && ["super_admin", "manager", "team_member"].includes(body.cmsRole)) {
        target.cmsRole = body.cmsRole;
      }
      if (Object.prototype.hasOwnProperty.call(body, "contentEditPermission")) {
        target.contentEditPermission = Boolean(body.contentEditPermission);
      }
      if (Object.prototype.hasOwnProperty.call(body, "contentManagerId")) {
        target.contentManagerId = body.contentManagerId || null;
      }
    }

    await target.save();

    await createCmsAuditLog({
      action: target.contentEditPermission ? "permission_granted" : "permission_revoked",
      actorUserId: user._id,
      actorRole,
      targetUserId: target._id,
      detail: target.contentEditPermission
        ? `Granted content edit permission to ${target.email}`
        : `Revoked content edit permission from ${target.email}`,
    });

    return ok({ user: toResponseUser(target) });
  } catch (caughtError) {
    console.error("CMS permissions PATCH error:", caughtError);
    return fail("Failed to update permissions", 500);
  }
}
