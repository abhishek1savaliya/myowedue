import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { lookupHandyBin } from "@/lib/handyBin";
import { clearUserApiCache } from "@/lib/redis";
import { requireUser } from "@/lib/session";
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

    const nextCardDigits = String(body.cardNumber || "").replace(/\D/g, "");
    const selection = nextCardDigits
      ? await lookupHandyBin(nextCardDigits)
      : {
          lookupBin: existing.lookupBin || "",
          cardTypeValue: existing.cardTypeValue,
          cardTypeLabel: existing.cardTypeLabel,
          issuingCountryCode: existing.issuingCountryCode,
          issuingCountryName: existing.issuingCountryName,
          issuingBankKey: existing.issuingBankKey,
          issuingBankName: existing.issuingBankName,
          variantValue: existing.variantValue,
          variantLabel: existing.variantLabel,
          network: existing.network,
        };
    const storedCardData = await resolveStoredCardData(body, user, existing);

    const card = await Card.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $set: { ...selection, ...storedCardData } },
      { returnDocument: "after" }
    );

    if (!card) return fail("Card not found", 404);

    await clearUserApiCache(user._id);
    await logActivity(user._id, "card_updated", `Updated ${selection.variantLabel} (${selection.issuingBankName})`);
    return ok({ card: await serializeCard(card, user), message: "Card updated successfully" });
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

    await clearUserApiCache(user._id);
    await logActivity(user._id, "card_deleted", `Deleted ${card.variantLabel} (${card.issuingBankName})`);
    return ok({ message: "Card deleted successfully" });
  } catch {
    return fail("Failed to delete card", 500);
  }
}
