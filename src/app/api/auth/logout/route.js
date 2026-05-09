import { ok } from "@/lib/api";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import UserSession from "@/models/UserSession";

export async function POST() {
  const store = await cookies();
  const token = store.get("session_token")?.value;
  const decoded = token ? verifyToken(token) : null;
  if (decoded?.userId && decoded?.sessionId) {
    await connectDB();
    await UserSession.updateOne(
      { userId: decoded.userId, sessionId: decoded.sessionId, status: "active" },
      { $set: { status: "revoked", revokedAt: new Date(), revokeReason: "user_logout" } }
    ).catch(() => {});
  }

  const res = ok({ message: "Logged out" });
  res.cookies.set("session_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
