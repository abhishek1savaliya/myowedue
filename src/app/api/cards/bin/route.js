import { fail, ok } from "@/lib/api";
import { lookupHandyBin } from "@/lib/handyBin";
import { requireUser } from "@/lib/session";

export async function GET(request) {
  const { error } = await requireUser();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const cardNumber = searchParams.get("number");
    const detected = await lookupHandyBin(cardNumber);
    return ok(detected);
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to lookup BIN", 422);
  }
}
