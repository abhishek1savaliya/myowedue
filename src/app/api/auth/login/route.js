import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { comparePassword, safeUser, signToken } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

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

    const token = signToken({ userId: user._id.toString() }, expiresIn);
    const res = ok({ user: safeUser(user), message: "Login successful" });
    res.cookies.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return res;
  } catch {
    return fail("Failed to login", 500);
  }
}
