const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

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

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

function normalizeCardCatalog(input = {}) {
  const rawInput = Array.isArray(input) ? { banks: input } : input?.catalog || input;
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

async function main() {
  const inputPathArg = process.argv[2];

  if (!inputPathArg) {
    console.error("Usage: npm run cards:import -- <path-to-json>");
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUri) {
    throw new Error("Missing MongoDB connection string. Set MONGODB_URI or DATABASE_URL.");
  }

  const resolvedPath = path.resolve(process.cwd(), inputPathArg);
  const raw = fs.readFileSync(resolvedPath, "utf8");
  const parsed = JSON.parse(raw);
  const normalized = normalizeCardCatalog(parsed);
  const now = new Date();

  await mongoose.connect(mongoUri, {
    bufferCommands: false,
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 30),
    minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 5),
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 5000),
  });

  const collection = mongoose.connection.collection("cardcatalogs");
  await collection.updateOne(
    { key: "default" },
    {
      $set: {
        key: "default",
        ...normalized,
        updatedAt: now,
        updatedByAdminName: "Script Import",
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );

  console.log(
    `Imported ${normalized.cardTypes.length} card types, ${normalized.countries.length} countries, and ${normalized.banks.length} banks from ${resolvedPath}`
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error?.message || error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
