import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { comparePassword, safeUser, signToken } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return fail("Email and password are required", 422);

    await connectDB();
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return fail("Invalid credentials", 401);

    const valid = await comparePassword(password, user.password);
    if (!valid) return fail("Invalid credentials", 401);

    const token = signToken({ userId: user._id.toString() });
    const res = ok({ user: safeUser(user), message: "Login successful" });
    res.cookies.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch {
    return fail("Failed to login", 500);
  }
}
