import { comparePassword } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";

export async function POST(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const password = String(body.password || "");

    if (!password) {
      return fail("Password is required", 422);
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return fail("Incorrect password", 401);
    }

    return ok({ message: "Password verified" });
  } catch {
    return fail("Failed to verify password", 500);
  }
}
