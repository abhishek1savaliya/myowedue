import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { ensureCardCatalog, resolveCardSelection, serializeCardCatalog } from "@/lib/cardCatalog";
import { resolveStoredCardData, serializeCard } from "@/lib/cardStorage";
import Card from "@/models/Card";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  await connectDB();
  const cards = await Card.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
  return ok({ cards: cards.map(serializeCard) });
}

export async function POST(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    await connectDB();
    const catalog = await ensureCardCatalog();
    const selection = resolveCardSelection(serializeCardCatalog(catalog), body);
    const storedCardData = await resolveStoredCardData(body, user);

    const card = await Card.create({
      userId: user._id,
      ...selection,
      ...storedCardData,
    });

    await logActivity(user._id, "card_created", `Added ${selection.variantLabel} (${selection.issuingBankName})`);
    return ok({ card: serializeCard(card), message: "Card added successfully" }, 201);
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to create card", 422);
  }
}
