import { connectDB } from "@/lib/db";
import AdminUser from "@/models/AdminUser";
import { hashPassword, comparePassword, signToken } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { encryptAdminPasswordPreview } from "@/lib/adminPasswordPreview";
import { cookies } from "next/headers";

// Seed the default superadmin if not exists
async function seedSuperAdmin() {
  const existing = await AdminUser.findOne({ email: "admin@myowedue.com" });
  if (!existing) {
    const hashed = await hashPassword("myadminworld");
    await AdminUser.create({
      name: "Super Admin",
      email: "admin@myowedue.com",
      password: hashed,
      role: "superadmin",
      employeeId: "ADMIN-001",
      isActive: true,
    });
  }
}

export async function POST(req) {
  try {
    const { username, password } = await req.json();

    const rawIdentifier = String(username || "").trim();
    const identifierLower = rawIdentifier.toLowerCase();
    const identifierUpper = rawIdentifier.toUpperCase();

    if (!rawIdentifier || !password) {
      return fail("Username and password are required", 400);
    }

    await connectDB();
    await seedSuperAdmin();

    // Single login route supports:
    // 1) admin alias
    // 2) email
    // 3) employeeId (ex: EMP-ABC123)
    const admin = await AdminUser.findOne({
      $or: [
        ...(identifierLower === "admin" ? [{ email: "admin@myowedue.com" }] : []),
        { email: identifierLower },
        { employeeId: identifierUpper },
      ],
    });
    if (!admin || !admin.isActive) {
      return fail("Invalid credentials", 401);
    }

    const valid = await comparePassword(password, admin.password);
    if (!valid) return fail("Invalid credentials", 401);

    await AdminUser.findByIdAndUpdate(admin._id, {
      lastLogin: new Date(),
      passwordPreviewEnc: encryptAdminPasswordPreview(password),
    });

    const token = signToken({ adminId: admin._id.toString(), role: admin.role });

    const store = await cookies();
    store.set("admin_session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return ok({
      admin: {
        id: admin._id.toString(),
        name: admin.name,
        email: admin.email,
        role: admin.role,
        employeeId: admin.employeeId,
      },
    });
  } catch (err) {
    console.error("Admin login error:", err);
    return fail("Internal server error", 500);
  }
}
