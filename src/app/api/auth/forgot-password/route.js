import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { createPasswordResetRequest } from "@/lib/password-reset";

export async function POST(request) {
  try {
    const { email } = await request.json();
    await connectDB();
    const result = await createPasswordResetRequest(email);

    if (!result.ok) {
      return fail(result.message, result.status);
    }

    return ok({ message: result.message });
  } catch (error) {
    console.error("Forgot password error:", error);
    return fail("Failed to submit reset request", 500);
  }
}
