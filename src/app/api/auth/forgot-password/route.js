import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { issuePasswordResetOtp } from "@/lib/password-reset";

export async function POST(request) {
  try {
    const { email } = await request.json();
    await connectDB();
    const result = await issuePasswordResetOtp(email);

    if (!result.ok) {
      return fail(result.message, result.status);
    }

    return ok({
      message: result.message,
      ...(result.devOtp ? { devOtp: result.devOtp } : {}),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return fail("Failed to send reset code", 500);
  }
}
