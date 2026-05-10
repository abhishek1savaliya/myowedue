import { connectDB } from "@/lib/db";
import AdminUser from "@/models/AdminUser";
import AdminTeamPeerRequest from "@/models/AdminTeamPeerRequest";
import { requireAdmin } from "@/lib/adminSession";
import { ok, fail } from "@/lib/api";
import {
  applySuperadminPatch,
  assertCanAcceptDelete,
  assertProposedPatchStillValid,
} from "@/lib/adminTeamPeerRequest";

export const runtime = "nodejs";

export async function POST(req, { params }) {
  const { admin, error } = await requireAdmin();
  if (error) return error;
  if (admin.role !== "superadmin") return fail("Forbidden", 403);

  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const decision = body.decision;
  if (!["accept", "reject"].includes(decision)) {
    return fail("decision must be accept or reject", 400);
  }

  try {
    await connectDB();

    const request = await AdminTeamPeerRequest.findById(id);
    if (!request) return fail("Request not found", 404);
    if (request.status !== "pending") return fail("This request is no longer pending", 409);
    if (String(request.targetUserId) !== String(admin._id)) {
      return fail("Only the affected team member can respond to this request", 403);
    }

    if (decision === "reject") {
      request.status = "rejected";
      request.resolvedAt = new Date();
      await request.save();
      return ok({ status: "rejected" });
    }

    const target = await AdminUser.findById(request.targetUserId);
    if (!target) {
      request.status = "rejected";
      request.resolvedAt = new Date();
      await request.save();
      return fail("Member no longer exists", 410);
    }

    if (request.kind === "delete") {
      const { error: delErr } = await assertCanAcceptDelete(target);
      if (delErr) {
        request.status = "rejected";
        request.resolvedAt = new Date();
        await request.save();
        return fail(delErr, 400);
      }
      await AdminUser.findByIdAndDelete(request.targetUserId);
      request.status = "accepted";
      request.resolvedAt = new Date();
      await request.save();
      return ok({ status: "accepted", deleted: true });
    }

    const patch = request.proposedPatch && typeof request.proposedPatch === "object" ? request.proposedPatch : {};
    if (Object.keys(patch).length === 0) {
      request.status = "rejected";
      request.resolvedAt = new Date();
      await request.save();
      return fail("Invalid update payload", 400);
    }

    const { error: stillValidErr } = await assertProposedPatchStillValid(target, patch);
    if (stillValidErr) {
      request.status = "rejected";
      request.resolvedAt = new Date();
      await request.save();
      return fail(stillValidErr, 400);
    }

    const { error: applyErr, updated } = await applySuperadminPatch(request.targetUserId, patch);
    if (applyErr || !updated) {
      request.status = "rejected";
      request.resolvedAt = new Date();
      await request.save();
      return fail(applyErr || "Could not apply update", 400);
    }

    request.status = "accepted";
    request.resolvedAt = new Date();
    await request.save();

    return ok({
      status: "accepted",
      member: {
        id: updated._id.toString(),
        name: updated.name,
        email: updated.email,
        role: updated.role,
        employeeId: updated.employeeId,
        managerId: updated.managerId?.toString() || null,
        isActive: updated.isActive,
      },
    });
  } catch (err) {
    console.error("Admin peer request POST error:", err);
    return fail("Internal server error", 500);
  }
}
