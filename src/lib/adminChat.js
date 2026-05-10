import AdminUser from "@/models/AdminUser";

/**
 * Whether `from` is allowed to send a direct message to `to`.
 */
export function canAdminChatWith(from, to) {
  if (!from || !to || !to.isActive) return false;
  if (String(from._id) === String(to._id)) return false;

  if (from.role === "superadmin") return true;

  if (from.role === "support") {
    return false;
  }

  if (from.role === "manager") {
    if (to.role === "superadmin") return true;
    if (to.role === "manager" && String(to._id) !== String(from._id)) return true;
    return false;
  }

  return false;
}

/**
 * Whether `viewer` may open a read thread with `peer` (includes support → superadmin inbox, read-only).
 */
export function canAdminViewChatThread(viewer, peer) {
  if (!viewer || !peer || !peer.isActive) return false;
  if (String(viewer._id) === String(peer._id)) return false;
  if (viewer.role === "superadmin") return true;
  if (viewer.role === "support" && peer.role === "superadmin") return true;
  return canAdminChatWith(viewer, peer);
}

export async function listChatRecipientsForAdmin(dbAdmin) {
  const selfId = dbAdmin._id;

  if (dbAdmin.role === "superadmin") {
    return AdminUser.find({ isActive: true, _id: { $ne: selfId } })
      .select("name email employeeId role")
      .sort({ name: 1 })
      .lean();
  }

  if (dbAdmin.role === "manager") {
    return AdminUser.find({
      isActive: true,
      _id: { $ne: selfId },
      $or: [{ role: "superadmin" }, { role: "manager" }],
    })
      .select("name email employeeId role")
      .sort({ name: 1 })
      .lean();
  }

  if (dbAdmin.role === "support") {
    return AdminUser.find({
      isActive: true,
      _id: { $ne: selfId },
      role: "superadmin",
    })
      .select("name email employeeId role")
      .sort({ name: 1 })
      .lean();
  }

  return [];
}

/** Label support users see instead of a superadmin's real name. */
export const SUPPORT_SUPERADMIN_PUBLIC_NAME = "Admin";

export function serializeRecipient(u) {
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    employeeId: u.employeeId,
    role: u.role,
  };
}

/** Hide superadmin identity (name, email, employee id) when the viewer is support. */
export function serializeRecipientForViewer(viewerRole, u) {
  const base = serializeRecipient(u);
  if (viewerRole === "support" && u.role === "superadmin") {
    return { ...base, name: SUPPORT_SUPERADMIN_PUBLIC_NAME, email: "", employeeId: "" };
  }
  return base;
}

export function serializePeerForViewer(viewerRole, peer) {
  const p = {
    id: peer._id.toString(),
    name: peer.name,
    email: peer.email,
    role: peer.role,
    employeeId: peer.employeeId,
  };
  if (viewerRole === "support" && peer.role === "superadmin") {
    return { ...p, name: SUPPORT_SUPERADMIN_PUBLIC_NAME, email: "", employeeId: "" };
  }
  return p;
}

export function serializeChatMessage(m) {
  return {
    id: m._id.toString(),
    message: m.message,
    createdAt: m.createdAt,
    from: {
      id: m.fromAdminId?._id?.toString?.() || "",
      name: m.fromAdminId?.name || "",
      role: m.fromAdminId?.role || "",
      employeeId: m.fromAdminId?.employeeId || "",
    },
    to: {
      id: m.toAdminId?._id?.toString?.() || "",
      name: m.toAdminId?.name || "",
      role: m.toAdminId?.role || "",
      employeeId: m.toAdminId?.employeeId || "",
    },
  };
}

export function maskMessageForSupportViewer(viewerRole, msg) {
  if (viewerRole !== "support") return msg;
  const out = {
    ...msg,
    from: { ...msg.from },
    to: { ...msg.to },
  };
  if (out.from.role === "superadmin") {
    out.from.name = SUPPORT_SUPERADMIN_PUBLIC_NAME;
    out.from.employeeId = "";
  }
  if (out.to.role === "superadmin") {
    out.to.name = SUPPORT_SUPERADMIN_PUBLIC_NAME;
    out.to.employeeId = "";
  }
  return out;
}

/** Profile / upward-message target card (API shape with string id). */
export function messageTargetForViewer(viewerRole, target) {
  if (!target) return null;
  if (viewerRole === "support" && target.role === "superadmin") {
    return {
      ...target,
      name: SUPPORT_SUPERADMIN_PUBLIC_NAME,
      email: "",
      employeeId: "",
    };
  }
  return target;
}
