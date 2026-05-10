import { connectDB } from "@/lib/db";
import AdminUser from "@/models/AdminUser";
import { hashPassword } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminSession";
import { ok, fail } from "@/lib/api";
import { encryptAdminPasswordPreview, decryptAdminPasswordPreview } from "@/lib/adminPasswordPreview";
import { listPendingPeerRequestsForViewer } from "@/lib/adminTeamPeerRequest";
import crypto from "crypto";

function generateEmployeeId() {
  return "EMP-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
  return Array.from(crypto.randomBytes(length))
    .map((b) => chars[b % chars.length])
    .join("");
}

function splitName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function GET(req) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  try {
    await connectDB();

    let filter = {};
    if (admin.role === "manager") {
      // Manager sees only their support team and themselves
      filter = {
        $or: [
          { _id: admin._id },
          { role: "support", managerId: admin._id },
        ],
      };
    } else if (admin.role === "support") {
      // Support sees their manager and all support under that manager (read-only in UI)
      if (admin.managerId) {
        filter = {
          $or: [
            { _id: admin.managerId },
            { role: "support", managerId: admin.managerId },
          ],
        };
      } else {
        filter = { _id: admin._id };
      }
    }

    const managersQuery =
      admin.role === "manager"
        ? AdminUser.find({ _id: admin._id, role: "manager" }).select("name email employeeId").sort({ name: 1 }).lean()
        : AdminUser.find({ role: "manager", isActive: true }).select("name email employeeId").sort({ name: 1 }).lean();

    const [team, managers, activeSuperadminCount] = await Promise.all([
      AdminUser.find(filter)
        .sort({ createdAt: -1 })
        .populate("managerId", "name email employeeId")
        .lean(),
      managersQuery,
      AdminUser.countDocuments({ role: "superadmin", isActive: true }),
    ]);

    let peerRequests = { incoming: [], outgoing: [] };
    let soleSuperadmin = false;
    if (admin.role === "superadmin") {
      peerRequests = await listPendingPeerRequestsForViewer(admin._id);
      soleSuperadmin = activeSuperadminCount === 1;
    }

    return ok({
      viewerRole: admin.role,
      viewerId: admin._id.toString(),
      soleSuperadmin,
      peerRequests,
      team: team.map((m) => ({
        id: m._id.toString(),
        name: m.name,
        email: m.email,
        role: m.role,
        employeeId: m.employeeId,
        managerId: m.managerId?._id?.toString?.() || m.managerId?.toString?.() || null,
        managerName: m.managerId?.name || "",
        passwordPreview:
          admin.role === "superadmin" || admin.role === "manager"
            ? decryptAdminPasswordPreview(m.passwordPreviewEnc)
            : "",
        canViewPassword:
          admin.role === "support"
            ? false
            : admin.role === "superadmin"
              ? m.role !== "superadmin"
              : admin.role === "manager"
                ? m._id.toString() === admin._id.toString() ||
                  (m.role === "support" &&
                    (m.managerId?._id?.toString?.() || m.managerId?.toString?.() || "") === admin._id.toString())
                : false,
        isActive: m.isActive,
        lastLogin: m.lastLogin,
        createdAt: m.createdAt,
      })),
      managers: managers.map((m) => ({
        id: m._id.toString(),
        name: m.name,
        email: m.email,
        employeeId: m.employeeId,
      })),
    });
  } catch (err) {
    console.error("Admin team GET error:", err);
    return fail("Internal server error", 500);
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  if (admin.role === "support") {
    return fail("Forbidden", 403);
  }

  try {
    const { name, email, role, managerId } = await req.json();

    if (!name || !email) {
      return fail("Name and email are required", 400);
    }

    const normalizedRole = role || "support";

    if (admin.role === "manager") {
      if (normalizedRole !== "support") {
        return fail("Managers may only add support employees", 403);
      }
    }

    if (normalizedRole === "support") {
      const effectiveManagerId = admin.role === "manager" ? admin._id.toString() : managerId;
      if (!effectiveManagerId) {
        return fail("Manager is required for support member", 400);
      }
    }

    if (admin.role === "superadmin" && normalizedRole === "support" && !managerId) {
      return fail("Manager is required for support member", 400);
    }

    await connectDB();

    const existing = await AdminUser.findOne({ email: email.toLowerCase() });
    if (existing) return fail("Email already in use", 409);

    let managerRef = null;
    if (normalizedRole === "support") {
      const mid = admin.role === "manager" ? admin._id : managerId;
      const manager = await AdminUser.findOne({ _id: mid, role: "manager", isActive: true });
      if (!manager) return fail("Invalid manager selected", 400);
      managerRef = manager._id;
    }

    const rawPassword = generatePassword();
    const hashed = await hashPassword(rawPassword);
    const passwordPreviewEnc = encryptAdminPasswordPreview(rawPassword);
    const employeeId = generateEmployeeId();
    const split = splitName(name);

    const member = await AdminUser.create({
      name,
      firstName: split.firstName,
      lastName: split.lastName,
      email: email.toLowerCase(),
      password: hashed,
      role: normalizedRole,
      employeeId,
      managerId: managerRef,
      passwordPreviewEnc,
      isActive: true,
    });

    // Return raw password once — admin must share it with employee
    return ok({
      member: {
        id: member._id.toString(),
        name: member.name,
        email: member.email,
        role: member.role,
        employeeId: member.employeeId,
      },
      generatedPassword: rawPassword,
    });
  } catch (err) {
    console.error("Admin team POST error:", err);
    return fail("Internal server error", 500);
  }
}
