import { requireAdmin } from "@/lib/adminSession";
import { ok } from "@/lib/api";

function splitName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  const split = splitName(admin.name);

  return ok({
    id: admin._id.toString(),
    firstName: admin.firstName || split.firstName,
    lastName: admin.lastName || split.lastName,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    employeeId: admin.employeeId,
    joinDate: admin.createdAt,
  });
}
