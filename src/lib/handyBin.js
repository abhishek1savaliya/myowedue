import { connectDB } from "@/lib/db";
import { getRedisJSON, setRedisJSON } from "@/lib/redis";
import Card from "@/models/Card";

const HANDY_BIN_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function humanize(value) {
  return String(value || "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function resolveCountry(source) {
  if (source && typeof source === "object" && !Array.isArray(source)) {
    return {
      code: pickString(
        source.code,
        source.iso2,
        source.alpha2,
        source.countryCode,
        source.A2,
        source.a2,
        source.alpha_2
      ).toUpperCase(),
      name: pickString(source.name, source.Name, source.countryName),
    };
  }

  if (typeof source === "string" && source.trim()) {
    const text = source.trim();
    if (/^[A-Za-z]{2}$/.test(text)) {
      return { code: text.toUpperCase(), name: text.toUpperCase() };
    }
    return { code: "", name: text };
  }

  return { code: "", name: "" };
}

function normalizeCardType(type) {
  const raw = pickString(type);
  const normalized = slugify(raw);

  if (normalized.includes("debit")) {
    return { value: "debit-card", label: "Debit Card" };
  }
  if (normalized.includes("credit")) {
    return { value: "credit-card", label: "Credit Card" };
  }
  if (normalized.includes("charge")) {
    return { value: "charge-card", label: "Charge Card" };
  }
  if (normalized.includes("prepaid")) {
    return { value: "prepaid-card", label: "Prepaid Card" };
  }
  if (normalized) {
    const label = humanize(raw);
    return {
      value: `${normalized}-card`,
      label: label.toLowerCase().includes("card") ? label : `${label} Card`,
    };
  }

  return { value: "payment-card", label: "Payment Card" };
}

function normalizeVariantLabel(tier, type, scheme) {
  const label = pickString(tier, type, scheme, "Card");
  return humanize(label);
}

function getPayloadRoot(payload) {
  if (Array.isArray(payload)) {
    return payload[0] || {};
  }

  if (payload && typeof payload === "object") {
    if (payload.data && typeof payload.data === "object") return payload.data;
    if (payload.result && typeof payload.result === "object") return payload.result;
  }

  return payload || {};
}

export function resolveLookupBin(value) {
  const digits = normalizeDigits(value);
  if (digits.length >= 8) return digits.slice(0, 8);
  if (digits.length >= 6) return digits.slice(0, 6);
  return "";
}

export function normalizeHandyBinPayload(payload, requestedBin = "") {
  const root = getPayloadRoot(payload);
  const countryDetails = resolveCountry(
    root.country || root.Country || root.country_data || root.countryData || {
      code: root.country_code || root.countryCode || root.CountryCode,
      name: root.country_name || root.countryName || root.CountryName,
    }
  );

  const scheme = pickString(root.scheme, root.Scheme, root.network, root.Network, root.brand, root.Brand);
  const type = pickString(root.type, root.Type, root.card_type, root.cardType, root.CardType);
  const tier = pickString(
    root.tier,
    root.Tier,
    root.level,
    root.Level,
    root.product,
    root.Product,
    root.card_level,
    root.cardLevel,
    root.CardTier
  );
  const issuerName = pickString(
    root.issuer,
    root.Issuer,
    root.bank,
    root.bank_name,
    root.bankName,
    root.BankName,
    root.issuer_name
  );
  const network = humanize(scheme || "Card");
  const cardType = normalizeCardType(type);
  const variantLabel = normalizeVariantLabel(tier, type, scheme);
  const variantValue = slugify(variantLabel) || "card";
  const issuingCountryCode = countryDetails.code || "UN";
  const issuingCountryName = countryDetails.name || "Unknown";
  const issuingBankName = issuerName || "Unknown Issuer";

  return {
    lookupBin: String(requestedBin || root.bin || root.iin || "").trim(),
    cardTypeValue: cardType.value,
    cardTypeLabel: cardType.label,
    issuingCountryCode,
    issuingCountryName,
    issuingBankKey: slugify(`${issuingBankName}-${issuingCountryCode}`) || "unknown-issuer",
    issuingBankName,
    variantValue,
    variantLabel,
    network,
    metadata: {
      scheme: scheme || network,
      type: type || cardType.label,
      tier: tier || variantLabel,
      issuer: issuingBankName,
      countryCode: issuingCountryCode,
      countryName: issuingCountryName,
      luhn: root.luhn ?? root.Luhn ?? null,
    },
  };
}

function isUsefulBinSelection(value) {
  if (!value || typeof value !== "object") return false;

  const issuer = String(value.issuingBankName || value.metadata?.issuer || "").trim().toLowerCase();
  const country = String(value.issuingCountryName || value.metadata?.countryName || "").trim().toLowerCase();
  const network = String(value.network || value.metadata?.scheme || "").trim().toLowerCase();
  const type = String(value.cardTypeLabel || value.metadata?.type || "").trim().toLowerCase();
  const variant = String(value.variantLabel || value.metadata?.tier || "").trim().toLowerCase();

  return !(
    !issuer ||
    !country ||
    !network ||
    !type ||
    !variant ||
    issuer === "unknown issuer" ||
    country === "unknown" ||
    network === "card" ||
    type === "payment card" ||
    variant === "card"
  );
}

function pickConfiguredApiKey() {
  return pickString(
    process.env.HANDYAPI_SECRET_KEY,
    process.env.HANDYAPI_BACKEND_API_KEY,
    process.env.HANDYAPI_KEY
  );
}

function buildStoredBinSelection(card) {
  if (!card) return null;

  return {
    lookupBin: String(card.lookupBin || "").trim(),
    cardTypeValue: String(card.cardTypeValue || "").trim(),
    cardTypeLabel: String(card.cardTypeLabel || "").trim(),
    issuingCountryCode: String(card.issuingCountryCode || "").trim(),
    issuingCountryName: String(card.issuingCountryName || "").trim(),
    issuingBankKey: String(card.issuingBankKey || "").trim(),
    issuingBankName: String(card.issuingBankName || "").trim(),
    variantValue: String(card.variantValue || "").trim(),
    variantLabel: String(card.variantLabel || "").trim(),
    network: String(card.network || "").trim(),
    metadata: {
      scheme: String(card.network || "").trim() || "Card",
      type: String(card.cardTypeLabel || "").trim() || "Payment Card",
      tier: String(card.variantLabel || "").trim() || "Card",
      issuer: String(card.issuingBankName || "").trim() || "Unknown Issuer",
      countryCode: String(card.issuingCountryCode || "").trim() || "UN",
      countryName: String(card.issuingCountryName || "").trim() || "Unknown",
      source: "database",
    },
  };
}

async function findStoredBinSelection(lookupBin) {
  try {
    await connectDB();
    const stored = await Card.findOne({ lookupBin })
      .sort({ updatedAt: -1 })
      .select({
        lookupBin: 1,
        cardTypeValue: 1,
        cardTypeLabel: 1,
        issuingCountryCode: 1,
        issuingCountryName: 1,
        issuingBankKey: 1,
        issuingBankName: 1,
        variantValue: 1,
        variantLabel: 1,
        network: 1,
      })
      .lean();

    return buildStoredBinSelection(stored);
  } catch (error) {
    console.error("Stored BIN lookup failed:", error?.message || error);
    return null;
  }
}

export async function lookupHandyBin(value) {
  const lookupBin = resolveLookupBin(value);
  if (!lookupBin) {
    throw new Error("Enter at least the first 6 digits of the card number");
  }

  const cacheKey = `cards:bin:${lookupBin}`;
  const cached = await getRedisJSON(cacheKey);
  if (isUsefulBinSelection(cached)) {
    return cached;
  }

  const stored = await findStoredBinSelection(lookupBin);
  if (isUsefulBinSelection(stored)) {
    await setRedisJSON(cacheKey, stored, HANDY_BIN_CACHE_TTL_SECONDS);
    return stored;
  }

  const apiKey = pickConfiguredApiKey();
  if (!apiKey) {
    throw new Error("HandyAPI backend secret is not configured");
  }

  let response;
  try {
    response = await fetch(`https://data.handyapi.com/bin/${lookupBin}`, {
      headers: {
        "x-api-key": apiKey,
      },
      cache: "no-store",
    });
  } catch {
    throw new Error("Failed to reach HandyAPI");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const apiMessage = pickString(payload?.message, payload?.error, payload?.detail);
    if (response.status === 404) {
      throw new Error(apiMessage || "No BIN details were found for those digits");
    }
    throw new Error(apiMessage || "HandyAPI lookup failed");
  }

  const normalized = normalizeHandyBinPayload(payload, lookupBin);
  await setRedisJSON(cacheKey, normalized, HANDY_BIN_CACHE_TTL_SECONDS);
  return normalized;
}
