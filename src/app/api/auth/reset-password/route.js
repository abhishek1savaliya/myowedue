import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { completePasswordReset } from "@/lib/password-reset";

export async function POST(request) {
  try {
    const { token, linkToken, email, otp, code, password } = await request.json();
    await connectDB();
    const result = await completePasswordReset({
      linkToken: linkToken || token,
      email,
      code: code || otp,
      password,
    });

    if (!result.ok) {
      return fail(result.message, result.status);
    }

    return ok({ message: result.message });
  } catch (error) {
    console.error("Reset password error:", error);
    return fail("Failed to reset password", 500);
  }
}
