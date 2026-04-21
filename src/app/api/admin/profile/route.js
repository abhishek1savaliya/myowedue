import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/adminSession";
import { ok, fail } from "@/lib/api";
import AdminUser from "@/models/AdminUser";

function splitName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

async function resolveMessageTarget(admin) {
  if (admin.role === "support") {
    if (!admin.managerId) return null;
    const manager = await AdminUser.findById(admin.managerId).select("name role employeeId email").lean();
    if (!manager) return null;
    return {
      id: manager._id.toString(),
      name: manager.name,
      role: manager.role,
      employeeId: manager.employeeId,
      email: manager.email,
    };
  }

  if (admin.role === "manager") {
    const superadmin = await AdminUser.findOne({ role: "superadmin", isActive: true })
      .sort({ createdAt: 1 })
      .select("name role employeeId email")
      .lean();
    if (!superadmin) return null;
    return {
      id: superadmin._id.toString(),
      name: superadmin.name,
      role: superadmin.role,
      employeeId: superadmin.employeeId,
      email: superadmin.email,
    };
  }

  return null;
}

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  try {
    await connectDB();
    const dbAdmin = await AdminUser.findById(admin._id).populate("managerId", "name role employeeId email").lean();
    if (!dbAdmin) return fail("User not found", 404);

    const split = splitName(dbAdmin.name);
    const firstName = dbAdmin.firstName || split.firstName;
    const lastName = dbAdmin.lastName || split.lastName;
    const messageTarget = await resolveMessageTarget(dbAdmin);

    return ok({
      profile: {
        id: dbAdmin._id.toString(),
        firstName,
        lastName,
        name: dbAdmin.name,
        email: dbAdmin.email,
        role: dbAdmin.role,
        employeeId: dbAdmin.employeeId,
        joinDate: dbAdmin.createdAt,
        manager: dbAdmin.managerId
          ? {
              id: dbAdmin.managerId._id.toString(),
              name: dbAdmin.managerId.name,
              role: dbAdmin.managerId.role,
              employeeId: dbAdmin.managerId.employeeId,
              email: dbAdmin.managerId.email,
            }
          : null,
      },
      messageTarget,
    });
  } catch (err) {
    console.error("Admin profile GET error:", err);
    return fail("Internal server error", 500);
  }
}

export async function PATCH(req) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  try {
    const { firstName, lastName } = await req.json();

    const f = String(firstName || "").trim();
    const l = String(lastName || "").trim();
    if (!f) return fail("First name is required", 400);

    await connectDB();
    const name = `${f} ${l}`.trim();

    const updated = await AdminUser.findByIdAndUpdate(
      admin._id,
      { firstName: f, lastName: l, name },
      { returnDocument: "after" }
    ).lean();

    if (!updated) return fail("User not found", 404);

    return ok({
      profile: {
        id: updated._id.toString(),
        firstName: updated.firstName || f,
        lastName: updated.lastName || l,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        employeeId: updated.employeeId,
        joinDate: updated.createdAt,
      },
    });
  } catch (err) {
    console.error("Admin profile PATCH error:", err);
    return fail("Internal server error", 500);
  }
}
