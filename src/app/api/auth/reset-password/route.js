import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { resetPasswordWithOtp } from "@/lib/password-reset";

export async function POST(request) {
  try {
    const { email, otp, password } = await request.json();
    await connectDB();
    const result = await resetPasswordWithOtp({ email, otp, password });

    if (!result.ok) {
      return fail(result.message, result.status);
    }

    return ok({ message: result.message });
  } catch (error) {
    console.error("Reset password error:", error);
    return fail("Failed to reset password", 500);
  }
}
