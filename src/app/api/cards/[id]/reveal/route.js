import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { revealStoredCardNumber, verifyRevealPassword } from "@/lib/cardStorage";
import Card from "@/models/Card";

export async function POST(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    await verifyRevealPassword(body.password, user);

    await connectDB();
    const card = await Card.findOne({ _id: id, userId: user._id });
    if (!card) return fail("Card not found", 404);

    const revealed = await revealStoredCardNumber(card, user);
    return ok({ card: revealed, message: "Card details revealed" });
  } catch (caughtError) {
    const message = caughtError?.message || "Failed to reveal card details";
    const status = message === "Incorrect password" ? 401 : message === "Password is required" ? 422 : 422;
    return fail(message, status);
  }
}
