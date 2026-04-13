import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { hashPassword, safeUser, signToken } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export async function POST(request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password || password.length < 6) {
      return fail("Name, email and password (min 6 chars) are required", 422);
    }

    await connectDB();
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return fail("Email already registered", 409);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: await hashPassword(password),
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
