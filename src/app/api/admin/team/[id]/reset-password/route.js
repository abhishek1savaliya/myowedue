import { connectDB } from "@/lib/db";
import AdminUser from "@/models/AdminUser";
import { hashPassword } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminSession";
import { ok, fail } from "@/lib/api";
import { encryptAdminPasswordPreview } from "@/lib/adminPasswordPreview";
import crypto from "crypto";

function generatePassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
  return Array.from(crypto.randomBytes(length))
    .map((b) => chars[b % chars.length])
    .join("");
}

export async function POST(req, { params }) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  if (admin.role === "support") return fail("Forbidden", 403);

  try {
    const { id } = await params;
    await connectDB();

    const member = await AdminUser.findById(id);
    if (!member) return fail("Team member not found", 404);

    if (admin.role === "manager") {
      const isSelf = member._id.toString() === admin._id.toString();
      const isTeamSupport =
        member.role === "support" && member.managerId?.toString() === admin._id.toString();
      if (!isSelf && !isTeamSupport) return fail("Forbidden", 403);
    } else if (admin.role !== "superadmin") {
      return fail("Forbidden", 403);
    }

    // Cannot reset superadmin password via this route (use login directly)
    if (member.role === "superadmin" && member._id.toString() === admin._id.toString()) {
      return fail("Cannot reset your own password via this route", 400);
    }

    const rawPassword = generatePassword();
    const hashed = await hashPassword(rawPassword);
    const passwordPreviewEnc = encryptAdminPasswordPreview(rawPassword);

    await AdminUser.findByIdAndUpdate(id, { password: hashed, passwordPreviewEnc });

    return ok({
      member: {
        id: member._id.toString(),
        name: member.name,
        email: member.email,
        employeeId: member.employeeId,
        role: member.role,
      },
      newPassword: rawPassword,
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return fail("Internal server error", 500);
  }
}
