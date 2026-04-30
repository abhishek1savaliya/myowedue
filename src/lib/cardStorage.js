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

function normalizeCardholderName(value) {
  return String(value || "").trim().slice(0, 120);
}

function normalizePrivateNote(value) {
  return String(value || "").trim().slice(0, 1000);
}

export async function resolveStoredCardData(payload = {}, user, existingCard = null) {
  if (String(payload.cvv || payload.encryptedCvv || "").trim()) {
    throw new Error("CVV cannot be stored in this app");
  }

  const digits = normalizeCardDigits(payload.cardNumber);
  const expiryMonth = normalizeExpiryMonth(payload.expiryMonth);
  const expiryYear = normalizeExpiryYear(payload.expiryYear);
  const nameOnCard = normalizeCardholderName(payload.nameOnCard);
  const privateNote = normalizePrivateNote(payload.privateNote);

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
    nameOnCard: "",
    expiryMonth: "",
    expiryYear: "",
  };

  const userKey = await deriveUserKey(user._id.toString(), user.email);

  if (digits) {
    nextData.encryptedCardNumber = await encryptField(digits, userKey);
  } else if (existingCard?.encryptedCardNumber) {
    nextData.encryptedCardNumber = existingCard.encryptedCardNumber;
  }

  nextData.encryptedExpiryMonth = await encryptField(expiryMonth, userKey);
  nextData.encryptedExpiryYear = await encryptField(expiryYear, userKey);
  nextData.encryptedNameOnCard = nameOnCard ? await encryptField(nameOnCard, userKey) : "";
  nextData.encryptedPrivateNote = privateNote ? await encryptField(privateNote, userKey) : "";

  return nextData;
}

async function decodeCardView(card, userKey) {
  const safeCard = typeof card?.toObject === "function" ? card.toObject() : card;

  let expiryMonth = safeCard.expiryMonth || "";
  let expiryYear = safeCard.expiryYear || "";
  let nameOnCard = safeCard.nameOnCard || "";
  let privateNote = "";

  if (safeCard.encryptedExpiryMonth) {
    try {
      expiryMonth = String(await decryptField(safeCard.encryptedExpiryMonth, userKey) || "");
    } catch {}
  }

  if (safeCard.encryptedExpiryYear) {
    try {
      expiryYear = String(await decryptField(safeCard.encryptedExpiryYear, userKey) || "");
    } catch {}
  }

  if (safeCard.encryptedNameOnCard) {
    try {
      nameOnCard = String(await decryptField(safeCard.encryptedNameOnCard, userKey) || "");
    } catch {}
  }

  if (safeCard.encryptedPrivateNote) {
    try {
      privateNote = String(await decryptField(safeCard.encryptedPrivateNote, userKey) || "");
    } catch {}
  }

  return { expiryMonth, expiryYear, nameOnCard, privateNote, safeCard };
}

export async function serializeCard(card, user, userKeyOverride = null) {
  const userKey = userKeyOverride || await deriveUserKey(user._id.toString(), user.email);
  const { expiryMonth, expiryYear, nameOnCard, privateNote, safeCard } = await decodeCardView(card, userKey);

  return {
    id: safeCard._id.toString(),
    cardTypeValue: safeCard.cardTypeValue,
    cardTypeLabel: safeCard.cardTypeLabel,
    issuingCountryCode: safeCard.issuingCountryCode,
    issuingCountryName: safeCard.issuingCountryName,
    issuingBankKey: safeCard.issuingBankKey,
    issuingBankName: safeCard.issuingBankName,
    variantValue: safeCard.variantValue,
    variantLabel: safeCard.variantLabel,
    network: safeCard.network,
    nameOnCard,
    privateNote,
    last4: safeCard.last4 || "",
    cardNumberLength: safeCard.cardNumberLength || 16,
    expiryMonth,
    expiryYear,
    hasStoredCardNumber: Boolean(safeCard.encryptedCardNumber),
    createdAt: safeCard.createdAt,
    updatedAt: safeCard.updatedAt,
  };
}

export async function revealStoredCardNumber(card, user) {
  if (!card?.encryptedCardNumber) {
    throw new Error("Full card number is unavailable for this card. Edit and save it again to store it securely.");
  }

  const userKey = await deriveUserKey(user._id.toString(), user.email);
  const cardNumber = await decryptField(card.encryptedCardNumber, userKey);
  const expiryMonth = card.encryptedExpiryMonth
    ? String(await decryptField(card.encryptedExpiryMonth, userKey) || "")
    : card.expiryMonth || "";
  const expiryYear = card.encryptedExpiryYear
    ? String(await decryptField(card.encryptedExpiryYear, userKey) || "")
    : card.expiryYear || "";
  const nameOnCard = card.encryptedNameOnCard
    ? String(await decryptField(card.encryptedNameOnCard, userKey) || "")
    : card.nameOnCard || "";
  const privateNote = card.encryptedPrivateNote
    ? String(await decryptField(card.encryptedPrivateNote, userKey) || "")
    : "";

  return {
    id: card._id.toString(),
    cardNumber: String(cardNumber || ""),
    expiryMonth,
    expiryYear,
    nameOnCard,
    privateNote,
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
