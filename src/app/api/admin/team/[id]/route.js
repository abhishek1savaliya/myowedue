import { connectDB } from "@/lib/db";
import AdminUser from "@/models/AdminUser";
import AdminTeamPeerRequest from "@/models/AdminTeamPeerRequest";
import { requireAdmin } from "@/lib/adminSession";
import { processQueuedContactTickets } from "@/lib/contactTicketAssignment";
import { ok, fail } from "@/lib/api";
import {
  applySuperadminPatch,
  assertCanAcceptDelete,
  computeSuperadminAllowedPatch,
  requiresPeerApprovalForSuperadminDelete,
  requiresPeerApprovalForSuperadminTarget,
} from "@/lib/adminTeamPeerRequest";

function memberPayload(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    employeeId: doc.employeeId,
    managerId: doc.managerId?.toString() || null,
    isActive: doc.isActive,
  };
}

export async function PATCH(req, { params }) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  if (admin.role === "support") return fail("Forbidden", 403);

  try {
    const { id } = await params;
    const body = await req.json();

    await connectDB();

    if (admin.role === "manager") {
      const target = await AdminUser.findById(id);
      if (!target) return fail("Member not found", 404);
      const onTeam =
        target.role === "support" && target.managerId?.toString() === admin._id.toString();
      if (!onTeam) return fail("Forbidden", 403);
      if (typeof body.isActive !== "boolean") {
        return fail("Managers can only update active status for their support team", 400);
      }
      const updated = await AdminUser.findByIdAndUpdate(
        id,
        { isActive: body.isActive },
        { returnDocument: "after" }
      );
      if (!updated) return fail("Member not found", 404);
      return ok({ member: memberPayload(updated) });
    }

    if (admin.role !== "superadmin") return fail("Forbidden", 403);

    const target = await AdminUser.findById(id);
    if (!target) return fail("Member not found", 404);

    const { error: patchErr, allowed } = await computeSuperadminAllowedPatch(target, admin, body);
    if (patchErr) return fail(patchErr, 400);
    if (Object.keys(allowed).length === 0) {
      return fail("No changes to apply", 400);
    }

    if (requiresPeerApprovalForSuperadminTarget(admin._id, target, body)) {
      try {
        await AdminTeamPeerRequest.create({
          targetUserId: target._id,
          requestedByUserId: admin._id,
          kind: "update",
          proposedPatch: allowed,
        });
      } catch (e) {
        if (e.code === 11000) {
          return fail("This member already has a pending approval request.", 409);
        }
        throw e;
      }
      return ok({
        pendingApproval: true,
        message: `${target.name} must accept this change before it takes effect.`,
      });
    }

    const { error: applyErr, updated } = await applySuperadminPatch(id, allowed);
    if (applyErr || !updated) return fail(applyErr || "Member not found", 404);

    return ok({ member: memberPayload(updated) });
  } catch (err) {
    console.error("Admin team PATCH error:", err);
    return fail("Internal server error", 500);
  }
}

export async function DELETE(req, { params }) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  if (admin.role === "support") return fail("Forbidden", 403);

  try {
    const { id } = await params;

    await connectDB();

    if (admin.role === "manager") {
      const target = await AdminUser.findById(id);
      if (!target) return fail("Member not found", 404);
      const onTeam =
        target.role === "support" && target.managerId?.toString() === admin._id.toString();
      if (!onTeam) return fail("Forbidden", 403);
      const { error: delErr } = await assertCanAcceptDelete(target);
      if (delErr) return fail(delErr, 400);
      await AdminUser.findByIdAndDelete(id);
      return ok({ message: "Deleted" });
    }

    if (admin.role !== "superadmin") return fail("Forbidden", 403);

    const target = await AdminUser.findById(id);
    if (!target) return fail("Member not found", 404);

    const { error: delErr } = await assertCanAcceptDelete(target);
    if (delErr) return fail(delErr, 400);

    if (requiresPeerApprovalForSuperadminDelete(admin._id, target)) {
      try {
        await AdminTeamPeerRequest.create({
          targetUserId: target._id,
          requestedByUserId: admin._id,
          kind: "delete",
          proposedPatch: null,
        });
      } catch (e) {
        if (e.code === 11000) {
          return fail("This member already has a pending approval request.", 409);
        }
        throw e;
      }
      return ok({
        pendingApproval: true,
        message: `${target.name} must accept this deletion before it takes effect.`,
      });
    }

    await AdminUser.findByIdAndDelete(id);
    return ok({ message: "Deleted" });
  } catch (err) {
    console.error("Admin team DELETE error:", err);
    return fail("Internal server error", 500);
  }
}
