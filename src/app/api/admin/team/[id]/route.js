import { connectDB } from "@/lib/db";
import AdminUser from "@/models/AdminUser";
import { requireAdmin } from "@/lib/adminSession";
import { ok, fail } from "@/lib/api";

export async function PATCH(req, { params }) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  if (admin.role !== "superadmin") return fail("Forbidden", 403);

  try {
    const { id } = await params;
    const body = await req.json();

    const allowed = {};
    if (typeof body.isActive === "boolean") allowed.isActive = body.isActive;
    if (body.role) allowed.role = body.role;
    if (body.name) allowed.name = body.name;

    await connectDB();

    if (Object.prototype.hasOwnProperty.call(body, "managerId")) {
      if (!body.managerId) {
        allowed.managerId = null;
      } else {
        const manager = await AdminUser.findOne({ _id: body.managerId, role: "manager", isActive: true });
        if (!manager) return fail("Invalid manager selected", 400);
        allowed.managerId = manager._id;
      }
    }

    const updated = await AdminUser.findByIdAndUpdate(id, allowed, { returnDocument: "after" });
    if (!updated) return fail("Member not found", 404);

    return ok({
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
    console.error("Admin team PATCH error:", err);
    return fail("Internal server error", 500);
  }
}

export async function DELETE(req, { params }) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  if (admin.role !== "superadmin") return fail("Forbidden", 403);

  try {
    const { id } = await params;

    await connectDB();
    await AdminUser.findByIdAndDelete(id);
    return ok({ message: "Deleted" });
  } catch (err) {
    console.error("Admin team DELETE error:", err);
    return fail("Internal server error", 500);
  }
}
