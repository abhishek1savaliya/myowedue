import { connectDB } from "@/lib/db";
import AdminUser from "@/models/AdminUser";
import { hashPassword } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminSession";
import { ok, fail } from "@/lib/api";
import { encryptAdminPasswordPreview, decryptAdminPasswordPreview } from "@/lib/adminPasswordPreview";
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
      // Support sees only their own profile
      filter = { _id: admin._id };
    }

    const [team, managers] = await Promise.all([
      AdminUser.find(filter)
        .sort({ createdAt: -1 })
        .populate("managerId", "name email employeeId")
        .lean(),
      AdminUser.find({ role: "manager", isActive: true })
        .select("name email employeeId")
        .sort({ name: 1 })
        .lean(),
    ]);

    return ok({
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

  // Only superadmin can create team members
  if (admin.role !== "superadmin") {
    return fail("Forbidden", 403);
  }

  try {
    const { name, email, role, managerId } = await req.json();

    if (!name || !email) {
      return fail("Name and email are required", 400);
    }

    const normalizedRole = role || "support";

    if (normalizedRole === "support" && !managerId) {
      return fail("Manager is required for support member", 400);
    }

    await connectDB();

    const existing = await AdminUser.findOne({ email: email.toLowerCase() });
    if (existing) return fail("Email already in use", 409);

    let managerRef = null;
    if (normalizedRole === "support") {
      const manager = await AdminUser.findOne({ _id: managerId, role: "manager", isActive: true });
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
