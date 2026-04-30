import { comparePassword } from "@/lib/auth";
import { decryptField, deriveUserKey, encryptField } from "@/lib/crypto";

function normalizeCardDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeExpiryMonth(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(2, "0").slice(-2);
}

function normalizeExpiryYear(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length >= 2 ? digits.slice(-2) : digits.padStart(2, "0");
}

export async function resolveStoredCardData(payload = {}, user, existingCard = null) {
  const digits = normalizeCardDigits(payload.cardNumber);
  const expiryMonth = normalizeExpiryMonth(payload.expiryMonth);
  const expiryYear = normalizeExpiryYear(payload.expiryYear);

  const nextLast4 = digits ? digits.slice(-4) : existingCard?.last4 || "";
  const nextLength = digits ? digits.length : existingCard?.cardNumberLength || 0;

  if (!existingCard && (digits.length < 12 || digits.length > 19)) {
    throw new Error("Enter a valid card number with 12 to 19 digits");
  }

  if (existingCard && digits && (digits.length < 12 || digits.length > 19)) {
    throw new Error("Enter a valid card number with 12 to 19 digits");
  }

  const monthNumber = Number.parseInt(expiryMonth, 10);
  if (!expiryMonth || Number.isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new Error("Enter a valid expiry month");
  }

  if (!expiryYear || expiryYear.length !== 2) {
    throw new Error("Enter a valid expiry year");
  }

  if (!nextLast4 || !nextLength) {
    throw new Error("Card number is required");
  }

  const nextData = {
    last4: nextLast4,
    cardNumberLength: nextLength,
    expiryMonth,
    expiryYear,
  };

  if (digits) {
    const userKey = await deriveUserKey(user._id.toString(), user.email);
    nextData.encryptedCardNumber = await encryptField(digits, userKey);
  } else if (existingCard?.encryptedCardNumber) {
    nextData.encryptedCardNumber = existingCard.encryptedCardNumber;
  }

  return nextData;
}

export function serializeCard(card) {
  return {
    id: card._id.toString(),
    cardTypeValue: card.cardTypeValue,
    cardTypeLabel: card.cardTypeLabel,
    issuingCountryCode: card.issuingCountryCode,
    issuingCountryName: card.issuingCountryName,
    issuingBankKey: card.issuingBankKey,
    issuingBankName: card.issuingBankName,
    variantValue: card.variantValue,
    variantLabel: card.variantLabel,
    network: card.network,
    nameOnCard: card.nameOnCard || "",
    last4: card.last4 || "",
    cardNumberLength: card.cardNumberLength || 16,
    expiryMonth: card.expiryMonth || "",
    expiryYear: card.expiryYear || "",
    hasStoredCardNumber: Boolean(card.encryptedCardNumber),
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}

export async function revealStoredCardNumber(card, user) {
  if (!card?.encryptedCardNumber) {
    throw new Error("Full card number is unavailable for this card. Edit and save it again to store it securely.");
  }

  const userKey = await deriveUserKey(user._id.toString(), user.email);
  const cardNumber = await decryptField(card.encryptedCardNumber, userKey);

  return {
    id: card._id.toString(),
    cardNumber: String(cardNumber || ""),
    expiryMonth: card.expiryMonth || "",
    expiryYear: card.expiryYear || "",
    last4: card.last4 || "",
  };
}

export async function verifyRevealPassword(password, user) {
  const candidate = String(password || "");
  if (!candidate) {
    throw new Error("Password is required");
  }

  const valid = await comparePassword(candidate, user.password);
  if (!valid) {
    throw new Error("Incorrect password");
  }
}
