import CardCatalog from "@/models/CardCatalog";

export const DEFAULT_CARD_CATALOG = {
  cardTypes: [
    { value: "credit-card", label: "Credit Card" },
    { value: "debit-card", label: "Debit Card" },
    { value: "charge-card", label: "Charge Card" },
  ],
  countries: [
    { code: "IN", name: "India" },
    { code: "AU", name: "Australia" },
    { code: "US", name: "United States" },
    { code: "GB", name: "United Kingdom" },
  ],
  banks: [
    {
      key: "hdfc-bank",
      name: "HDFC Bank",
      countryCode: "IN",
      cardTypes: ["credit-card"],
      variants: [
        { value: "regalia-gold", label: "Regalia Gold", network: "Visa" },
        { value: "diners-club-black", label: "Diners Club Black", network: "Diners Club" },
        { value: "millennia", label: "Millennia", network: "Mastercard" },
      ],
    },
    {
      key: "axis-bank",
      name: "Axis Bank",
      countryCode: "IN",
      cardTypes: ["credit-card"],
      variants: [
        { value: "magnus", label: "Magnus", network: "Visa" },
        { value: "atlas", label: "Atlas", network: "Visa" },
        { value: "select", label: "Select", network: "Mastercard" },
      ],
    },
    {
      key: "icici-bank",
      name: "ICICI Bank",
      countryCode: "IN",
      cardTypes: ["credit-card"],
      variants: [
        { value: "sapphiro", label: "Sapphiro", network: "Mastercard" },
        { value: "emeralde-private-metal", label: "Emeralde Private Metal", network: "American Express" },
        { value: "coral", label: "Coral", network: "Visa" },
      ],
    },
    {
      key: "sbi-card",
      name: "SBI Card",
      countryCode: "IN",
      cardTypes: ["credit-card"],
      variants: [
        { value: "cashback-card", label: "Cashback Card", network: "Visa" },
        { value: "prime", label: "Prime", network: "Mastercard" },
      ],
    },
    {
      key: "commonwealth-bank",
      name: "Commonwealth Bank",
      countryCode: "AU",
      cardTypes: ["credit-card", "debit-card"],
      variants: [
        { value: "smart-awards", label: "Smart Awards", network: "Mastercard" },
        { value: "ultimate-awards", label: "Ultimate Awards", network: "Visa" },
      ],
    },
    {
      key: "westpac",
      name: "Westpac",
      countryCode: "AU",
      cardTypes: ["credit-card", "debit-card"],
      variants: [
        { value: "altitude-black", label: "Altitude Black", network: "Visa" },
        { value: "lite", label: "Lite", network: "Mastercard" },
      ],
    },
    {
      key: "american-express-us",
      name: "American Express",
      countryCode: "US",
      cardTypes: ["credit-card", "charge-card"],
      variants: [
        { value: "gold-card", label: "Gold Card", network: "American Express" },
        { value: "platinum-card", label: "Platinum Card", network: "American Express" },
      ],
    },
    {
      key: "barclays-uk",
      name: "Barclays",
      countryCode: "GB",
      cardTypes: ["credit-card", "debit-card"],
      variants: [
        { value: "barclaycard-rewards", label: "Barclaycard Rewards", network: "Visa" },
        { value: "premier", label: "Premier", network: "Mastercard" },
      ],
    },
  ],
};

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const COUNTRY_NAME_BY_CODE = {
  AE: "United Arab Emirates",
  AU: "Australia",
  CA: "Canada",
  GB: "United Kingdom",
  IN: "India",
  SG: "Singapore",
  US: "United States",
};

const NETWORK_LABEL_BY_VALUE = {
  amex: "American Express",
  "american-express": "American Express",
  diners: "Diners Club",
  "diners-club": "Diners Club",
  jcb: "JCB",
  mastercard: "Mastercard",
  visa: "Visa",
};

function humanizeToken(value) {
  return String(value || "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeNetworkLabel(value) {
  const normalizedValue = slugify(value);
  return NETWORK_LABEL_BY_VALUE[normalizedValue] || humanizeToken(value);
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deriveCardTypesFromBanks(banks) {
  return uniqueBy(
    (Array.isArray(banks) ? banks : [])
      .flatMap((bank) => (Array.isArray(bank?.cardTypes) ? bank.cardTypes : []))
      .map((item) => {
        const value = slugify(item);
        if (!value) return null;
        return {
          value,
          label: humanizeToken(item),
        };
      })
      .filter(Boolean),
    (item) => item.value
  );
}

function deriveCountriesFromBanks(banks) {
  return uniqueBy(
    (Array.isArray(banks) ? banks : [])
      .map((bank) => {
        const code = String(bank?.countryCode || bank?.country || "").trim().toUpperCase();
        if (!code) return null;
        return {
          code,
          name: COUNTRY_NAME_BY_CODE[code] || code,
        };
      })
      .filter(Boolean),
    (item) => item.code
  );
}

function normalizeCardTypes(cardTypes) {
  if (!Array.isArray(cardTypes) || cardTypes.length === 0) {
    throw new Error("cardTypes must be a non-empty array");
  }

  const normalized = uniqueBy(
    cardTypes
      .map((item) => {
        const fallbackValue = item?.value || item?.name || item;
        const value = slugify(fallbackValue);
        const label = String(item?.label || item?.name || humanizeToken(fallbackValue) || "").trim();
        if (!label || !value) return null;
        return { value, label };
      })
      .filter(Boolean),
    (item) => item.value
  );

  if (normalized.length === 0) {
    throw new Error("cardTypes must include at least one valid option");
  }

  return normalized;
}

function normalizeCountries(countries) {
  if (!Array.isArray(countries) || countries.length === 0) {
    throw new Error("countries must be a non-empty array");
  }

  const normalized = uniqueBy(
    countries
      .map((item) => {
        const code = String(item?.code || item?.value || item || "").trim().toUpperCase();
        const name = String(item?.name || item?.label || COUNTRY_NAME_BY_CODE[code] || code || "").trim();
        if (!name || !code) return null;
        return { code, name };
      })
      .filter(Boolean),
    (item) => item.code
  );

  if (normalized.length === 0) {
    throw new Error("countries must include at least one valid option");
  }

  return normalized;
}

function normalizeVariants(variants) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return [];
  }

  return uniqueBy(
    variants
      .map((item) => {
        const label = String(item?.label || item?.name || item || "").trim();
        const value = slugify(item?.value || label);
        const network = normalizeNetworkLabel(item?.network);
        if (!label || !value || !network) return null;
        return { value, label, network };
      })
      .filter(Boolean),
    (item) => item.value
  );
}

function normalizeBanks(banks, validCountryCodes, validCardTypes) {
  if (!Array.isArray(banks) || banks.length === 0) {
    throw new Error("banks must be a non-empty array");
  }

  const normalized = uniqueBy(
    banks
      .map((item) => {
        const name = String(item?.name || item?.label || "").trim();
        const key = slugify(item?.id || item?.key || item?.value || name);
        const countryCode = String(item?.countryCode || item?.country || "").trim().toUpperCase();
        const cardTypes = Array.isArray(item?.cardTypes)
          ? uniqueBy(
              item.cardTypes
                .map((entry) => slugify(entry))
                .filter((entry) => validCardTypes.has(entry)),
              (entry) => entry
            )
          : [];
        const variants = normalizeVariants(item?.variants);

        if (!name || !key || !countryCode || !validCountryCodes.has(countryCode)) {
          return null;
        }

        return { key, name, countryCode, cardTypes, variants };
      })
      .filter(Boolean),
    (item) => item.key
  );

  if (normalized.length === 0) {
    throw new Error("banks must include at least one valid bank");
  }

  return normalized;
}

export function normalizeCardCatalog(input = {}) {
  const rawInput = Array.isArray(input) ? { banks: input } : input;
  const rawBanks = Array.isArray(rawInput?.banks) ? rawInput.banks : [];
  const sourceCardTypes =
    Array.isArray(rawInput?.cardTypes) && rawInput.cardTypes.length > 0
      ? rawInput.cardTypes
      : deriveCardTypesFromBanks(rawBanks);
  const sourceCountries =
    Array.isArray(rawInput?.countries) && rawInput.countries.length > 0
      ? rawInput.countries
      : deriveCountriesFromBanks(rawBanks);

  const cardTypes = normalizeCardTypes(sourceCardTypes);
  const countries = normalizeCountries(sourceCountries);
  const validCardTypes = new Set(cardTypes.map((item) => item.value));
  const validCountryCodes = new Set(countries.map((item) => item.code));
  const banks = normalizeBanks(rawBanks, validCountryCodes, validCardTypes);

  return { cardTypes, countries, banks };
}

export async function ensureCardCatalog() {
  let catalog = await CardCatalog.findOne({ key: "default" });

  if (!catalog) {
    catalog = await CardCatalog.create({
      key: "default",
      ...normalizeCardCatalog(DEFAULT_CARD_CATALOG),
    });
  }

  return catalog;
}

export function serializeCardCatalog(catalog) {
  return {
    cardTypes: Array.isArray(catalog?.cardTypes) ? catalog.cardTypes.map((item) => ({ value: item.value, label: item.label })) : [],
    countries: Array.isArray(catalog?.countries) ? catalog.countries.map((item) => ({ code: item.code, name: item.name })) : [],
    banks: Array.isArray(catalog?.banks)
      ? catalog.banks.map((item) => ({
          key: item.key,
          name: item.name,
          countryCode: item.countryCode,
          cardTypes: Array.isArray(item.cardTypes) ? item.cardTypes : [],
          variants: Array.isArray(item.variants)
            ? item.variants.map((variant) => ({
                value: variant.value,
                label: variant.label,
                network: variant.network,
              }))
            : [],
        }))
      : [],
  };
}

export function resolveCardSelection(catalog, payload = {}) {
  const cardTypeValue = slugify(payload.cardTypeValue);
  const issuingCountryCode = String(payload.issuingCountryCode || "").trim().toUpperCase();
  const issuingBankKey = slugify(payload.issuingBankKey);
  const variantValue = slugify(payload.variantValue);
  const nameOnCard = String(payload.nameOnCard || "").trim();

  const cardType = catalog.cardTypes.find((item) => item.value === cardTypeValue);
  if (!cardType) throw new Error("Select a valid card type");

  const country = catalog.countries.find((item) => item.code === issuingCountryCode);
  if (!country) throw new Error("Select a valid issuing country");

  const bank = catalog.banks.find(
    (item) =>
      item.key === issuingBankKey &&
      item.countryCode === issuingCountryCode &&
      (!Array.isArray(item.cardTypes) || item.cardTypes.length === 0 || item.cardTypes.includes(cardTypeValue))
  );
  if (!bank) throw new Error("Select a valid issuing bank");

  const variant = Array.isArray(bank.variants) ? bank.variants.find((item) => item.value === variantValue) : null;
  if (!variant) throw new Error("Select a valid card variant");

  return {
    cardTypeValue: cardType.value,
    cardTypeLabel: cardType.label,
    issuingCountryCode: country.code,
    issuingCountryName: country.name,
    issuingBankKey: bank.key,
    issuingBankName: bank.name,
    variantValue: variant.value,
    variantLabel: variant.label,
    network: variant.network,
    nameOnCard,
  };
}
