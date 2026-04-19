import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Notification from "@/models/Notification";
import { hashPassword, safeUser, signToken } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export async function POST(request) {
  try {
    const { firstName, lastName, email, password, phone } = await request.json();
    const normalizedFirst = String(firstName || "").trim();
    const normalizedLast = String(lastName || "").trim();
    const fullName = `${normalizedFirst} ${normalizedLast}`.trim();

    if (!normalizedFirst || !normalizedLast || !email || !password || password.length < 6) {
      return fail("First name, last name, email and password (min 6 chars) are required", 422);
    }

    await connectDB();
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return fail("Email already registered", 409);

    const user = await User.create({
      firstName: normalizedFirst,
      lastName: normalizedLast,
      name: fullName,
      email: email.toLowerCase().trim(),
      password: await hashPassword(password),
      phone: String(phone || "").trim(),
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await Notification.create({
      userId: user._id,
      type: "welcome",
      title: "Welcome to MYOWEDUE",
      message: "Welcome to MYOWEDUE! I hope you will love this app.",
      meta: {},
      expiresAt,
    });

    const token = signToken({ userId: user._id.toString() });
    const res = ok({ user: safeUser(user), message: "Signup successful" }, 201);
    res.cookies.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (error) {
    console.error("Signup error:", error);
    const message =
      process.env.NODE_ENV === "development"
        ? error?.message || "Failed to signup"
        : "Failed to signup";
    return fail(message, 500);
  }
}
