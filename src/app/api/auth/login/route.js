import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { comparePassword, safeUser, signToken } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { randomUUID } from "crypto";
import UserSession from "@/models/UserSession";
import { enforceConcurrentSessionLimit, extractClientIp } from "@/lib/session";

export async function POST(request) {
  try {
    const { email, password, rememberMe } = await request.json();
    if (!email || !password) return fail("Email and password are required", 422);

    await connectDB();
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return fail("Invalid credentials", 401);

    const valid = await comparePassword(password, user.password);
    if (!valid) return fail("Invalid credentials", 401);

    // Set expiration based on rememberMe checkbox
    // 7 days if rememberMe is true, 4 hours if false
    const expiresIn = rememberMe ? "7d" : "4h";
    const maxAge = rememberMe ? 60 * 60 * 24 * 7 : 60 * 60 * 4;
    const sessionId = randomUUID();
    const ip = extractClientIp(request);
    const userAgent = String(request.headers.get("user-agent") || "").slice(0, 240);

    await UserSession.create({
      userId: user._id,
      sessionId,
      ip,
      userAgent,
      rememberMe: Boolean(rememberMe),
      status: "active",
      lastSeenAt: new Date(),
    });
    await enforceConcurrentSessionLimit(user._id, user.concurrentSessionLimit || 1);

    const token = signToken({ userId: user._id.toString(), sessionId }, expiresIn);
    const res = ok({ user: safeUser(user), message: "Login successful" });
    res.cookies.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return res;
  } catch (error) {
    console.error("Login error:", error?.message || error);
    const msg = String(error?.message || "");
    if (
      msg.includes("MONGODB_URI") ||
      msg.includes("querySrv") ||
      msg.includes("ENOTFOUND") ||
      msg.includes("Mongo") ||
      msg.includes("buffering timed out") ||
      msg.includes("server selection")
    ) {
      return fail("Database unavailable. Please try again later.", 503);
    }
    return fail("Failed to login", 500);
  }
}
