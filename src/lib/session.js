import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export async function getSessionUser() {
  const store = await cookies();
  const token = store.get("session_token")?.value;

  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;

  await connectDB();
  const user = await User.findById(decoded.userId);
  if (!user) return null;

  return user;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    return {
      error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
      user: null,
    };
  }

  return { error: null, user };
}
