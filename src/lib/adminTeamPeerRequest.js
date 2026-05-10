import { connectDB } from "@/lib/db";
import AdminUser from "@/models/AdminUser";
import AdminTeamPeerRequest from "@/models/AdminTeamPeerRequest";
import { processQueuedContactTickets } from "@/lib/contactTicketAssignment";

export function requiresPeerApprovalForSuperadminTarget(actorId, target, body) {
  if (!target || target.role !== "superadmin") return false;
  if (String(target._id) === String(actorId)) return false;
  if (body.role) return true;
  if (Object.prototype.hasOwnProperty.call(body, "isActive")) return true;
  return false;
}

export function requiresPeerApprovalForSuperadminDelete(actorId, target) {
  if (!target || target.role !== "superadmin") return false;
  return String(target._id) !== String(actorId);
}

/**
 * Build the Mongo $set-style patch for a superadmin acting on `target`.
 * Returns { error, allowed } where allowed is plain object for findByIdAndUpdate.
 */
export async function computeSuperadminAllowedPatch(target, actor, body) {
  if (
    typeof body.isActive === "boolean" &&
    body.isActive === false &&
    target.role === "superadmin" &&
    String(target._id) === String(actor._id)
  ) {
    const n = await AdminUser.countDocuments({ role: "superadmin", isActive: true });
    if (n < 2) {
      return { error: "Add another active superadmin before disabling your own account", allowed: null };
    }
  }

  const allowed = {};

  if (typeof body.isActive === "boolean") allowed.isActive = body.isActive;
  if (body.name) allowed.name = body.name;

  if (body.role) {
    const r = body.role;
    if (!["superadmin", "manager", "support"].includes(r)) {
      return { error: "Invalid role", allowed: null };
    }

    if (target.role === "superadmin" && r !== "superadmin") {
      const activeSupers = await AdminUser.countDocuments({ role: "superadmin", isActive: true });
      if (activeSupers < 2) {
        return { error: "At least one active superadmin must remain", allowed: null };
      }
    }

    if (String(target._id) === String(actor._id) && r !== "superadmin") {
      const otherSupers = await AdminUser.countDocuments({
        role: "superadmin",
        isActive: true,
        _id: { $ne: actor._id },
      });
      if (otherSupers < 1) {
        return { error: "Add another active superadmin before changing your own role", allowed: null };
      }
    }

    allowed.role = r;

    if (r === "superadmin" || r === "manager") {
      allowed.managerId = null;
    } else if (r === "support") {
      const mid = body.managerId || target.managerId?.toString();
      if (!mid) return { error: "Manager is required when assigning support role", allowed: null };
      const mgr = await AdminUser.findOne({ _id: mid, role: "manager", isActive: true });
      if (!mgr) return { error: "Invalid manager selected", allowed: null };
      allowed.managerId = mgr._id;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "managerId") && !body.role) {
    if (target.role !== "support") {
      return { error: "Only support members can be assigned to a manager", allowed: null };
    }
    if (!body.managerId) {
      allowed.managerId = null;
    } else {
      const manager = await AdminUser.findOne({ _id: body.managerId, role: "manager", isActive: true });
      if (!manager) return { error: "Invalid manager selected", allowed: null };
      allowed.managerId = manager._id;
    }
  }

  return { error: null, allowed };
}

export async function applySuperadminPatch(targetId, allowed) {
  const updated = await AdminUser.findByIdAndUpdate(targetId, allowed, { returnDocument: "after" });
  if (!updated) return { error: "Member not found", updated: null };

  const shouldFlushQueue =
    updated.role === "manager" &&
    updated.isActive &&
    (allowed.isActive === true || allowed.role === "manager");
  if (shouldFlushQueue) {
    try {
      await processQueuedContactTickets();
    } catch (e) {
      console.error("processQueuedContactTickets after team update:", e);
    }
  }

  return { error: null, updated };
}

export async function assertCanAcceptDelete(target) {
  if (!target) return { error: "Member not found" };
  if (target.role === "superadmin") {
    const n = await AdminUser.countDocuments({ role: "superadmin", isActive: true });
    if (n < 2) {
      return { error: "Cannot remove the only active superadmin" };
    }
  }
  return { error: null };
}

/** Re-check constraints at accept time (counts / manager may have changed). */
export async function assertProposedPatchStillValid(target, patch) {
  if (!target || !patch || typeof patch !== "object") {
    return { error: "Invalid update" };
  }

  const nextRole = patch.role !== undefined ? patch.role : target.role;

  if (target.role === "superadmin" && nextRole !== "superadmin") {
    const n = await AdminUser.countDocuments({ role: "superadmin", isActive: true });
    if (n < 2) {
      return { error: "At least one active superadmin must remain" };
    }
  }

  if (patch.isActive === false && target.role === "superadmin") {
    const n = await AdminUser.countDocuments({ role: "superadmin", isActive: true });
    if (n < 2) {
      return { error: "Cannot disable the only active superadmin" };
    }
  }

  if (nextRole === "support") {
    const mid = patch.managerId || target.managerId?.toString();
    if (!mid) return { error: "Manager is required for support role" };
    const mgr = await AdminUser.findOne({ _id: mid, role: "manager", isActive: true });
    if (!mgr) return { error: "Invalid manager selected" };
  }

  return { error: null };
}

function serializeRequest(doc, userMap) {
  const reqBy = userMap.get(doc.requestedByUserId?.toString());
  const tgt = userMap.get(doc.targetUserId?.toString());
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    status: doc.status,
    createdAt: doc.createdAt,
    proposedPatch: doc.proposedPatch || null,
    requestedBy: reqBy ? { id: reqBy._id.toString(), name: reqBy.name, email: reqBy.email } : null,
    target: tgt ? { id: tgt._id.toString(), name: tgt.name, email: tgt.email } : null,
  };
}

export async function listPendingPeerRequestsForViewer(viewerId) {
  await connectDB();
  const pending = await AdminTeamPeerRequest.find({ status: "pending" })
    .sort({ createdAt: -1 })
    .lean();

  const incoming = pending.filter((p) => String(p.targetUserId) === String(viewerId));
  const outgoing = pending.filter((p) => String(p.requestedByUserId) === String(viewerId));

  const ids = new Set();
  for (const p of [...incoming, ...outgoing]) {
    ids.add(String(p.targetUserId));
    ids.add(String(p.requestedByUserId));
  }

  const users = await AdminUser.find({ _id: { $in: [...ids] } })
    .select("name email")
    .lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  return {
    incoming: incoming.map((p) => serializeRequest(p, userMap)),
    outgoing: outgoing.map((p) => serializeRequest(p, userMap)),
  };
}
