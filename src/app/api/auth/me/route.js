import { requireUser } from "@/lib/session";
import { ok } from "@/lib/api";
import { safeUser } from "@/lib/auth";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  return ok({ user: safeUser(user) });
}
