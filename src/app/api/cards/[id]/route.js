import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { ensureCardCatalog, resolveCardSelection, serializeCardCatalog } from "@/lib/cardCatalog";
import { resolveStoredCardData, serializeCard } from "@/lib/cardStorage";
import Card from "@/models/Card";

export async function PUT(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    await connectDB();
    const existing = await Card.findOne({ _id: id, userId: user._id });
    if (!existing) return fail("Card not found", 404);

    const catalog = await ensureCardCatalog();
    const selection = resolveCardSelection(serializeCardCatalog(catalog), body);
    const storedCardData = await resolveStoredCardData(body, user, existing);

    const card = await Card.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $set: { ...selection, ...storedCardData } },
      { returnDocument: "after" }
    );

    if (!card) return fail("Card not found", 404);

    await logActivity(user._id, "card_updated", `Updated ${selection.variantLabel} (${selection.issuingBankName})`);
    return ok({ card: serializeCard(card), message: "Card updated successfully" });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to update card", 422);
  }
}

export async function DELETE(_request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    await connectDB();
    const card = await Card.findOneAndDelete({ _id: id, userId: user._id });
    if (!card) return fail("Card not found", 404);

    await logActivity(user._id, "card_deleted", `Deleted ${card.variantLabel} (${card.issuingBankName})`);
    return ok({ message: "Card deleted successfully" });
  } catch {
    return fail("Failed to delete card", 500);
  }
}
