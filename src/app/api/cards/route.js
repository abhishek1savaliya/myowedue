import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { lookupHandyBin } from "@/lib/handyBin";
import { deriveUserKey } from "@/lib/crypto";
import { cardsCacheKey, clearUserApiCache, getRedisJSON, setRedisJSON } from "@/lib/redis";
import { requireUser } from "@/lib/session";
import { resolveStoredCardData, serializeCard } from "@/lib/cardStorage";
import Card from "@/models/Card";

export async function GET(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const cacheControl = String(request.headers.get("cache-control") || "").toLowerCase();
  const pragma = String(request.headers.get("pragma") || "").toLowerCase();
  const forceFresh = cacheControl.includes("no-store") || cacheControl.includes("no-cache") || pragma.includes("no-cache");
  const cacheKey = cardsCacheKey(user._id);
  if (!forceFresh) {
    const cached = await getRedisJSON(cacheKey);
    if (cached) return ok(cached);
  }

  await connectDB();
  const cards = await Card.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
  const userKey = await deriveUserKey(user._id.toString(), user.email);
  const payload = { cards: await Promise.all(cards.map((card) => serializeCard(card, user, userKey))) };
  await setRedisJSON(cacheKey, payload, 90);
  return ok(payload);
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

    await clearUserApiCache(user._id);
    await logActivity(user._id, "card_created", `Added ${selection.variantLabel} (${selection.issuingBankName})`);
    return ok({ card: await serializeCard(card, user), message: "Card added successfully" }, 201);
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to create card", 422);
  }
}
