import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import AdminUser from "@/models/AdminUser";

export async function getAdminSession() {
  const store = await cookies();
  const token = store.get("admin_session_token")?.value;
  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded?.adminId) return null;

  await connectDB();
  const admin = await AdminUser.findById(decoded.adminId);
  if (!admin || !admin.isActive) return null;

  return admin;
}

export async function requireAdmin() {
  const admin = await getAdminSession();
  if (!admin) {
    return {
      error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
      admin: null,
    };
  }
  return { error: null, admin };
}
