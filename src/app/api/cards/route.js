import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { lookupHandyBin } from "@/lib/handyBin";
import { requireUser } from "@/lib/session";
import { resolveStoredCardData, serializeCard } from "@/lib/cardStorage";
import Card from "@/models/Card";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  await connectDB();
  const cards = await Card.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
  return ok({ cards: await Promise.all(cards.map((card) => serializeCard(card, user))) });
}

export async function POST(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    await connectDB();
    const selection = await lookupHandyBin(body.cardNumber);
    const storedCardData = await resolveStoredCardData(body, user);

    const card = await Card.create({
      userId: user._id,
      ...selection,
      ...storedCardData,
    });

    await logActivity(user._id, "card_created", `Added ${selection.variantLabel} (${selection.issuingBankName})`);
    return ok({ card: await serializeCard(card, user), message: "Card added successfully" }, 201);
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to create card", 422);
  }
}
