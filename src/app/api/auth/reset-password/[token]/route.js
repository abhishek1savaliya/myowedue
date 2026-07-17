import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { getPasswordResetLinkStatus } from "@/lib/password-reset";

export async function GET(_request, { params }) {
  try {
    const { token } = await params;
    await connectDB();
    const result = await getPasswordResetLinkStatus(token);

    if (!result.ok) {
      return fail(result.message, result.status);
    }

    return ok({ reset: result.reset });
  } catch (error) {
    console.error("Reset link status error:", error);
    return fail("Failed to load reset link", 500);
  }
}
