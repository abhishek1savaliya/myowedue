import crypto from "crypto";
import { connectDB } from "@/lib/db";
import BankCardTheme from "@/models/BankCardTheme";

/** @param {number} h 0–360 @param {number} s @param {number} l 0–100 */
function hslToRgb(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.min(100, Math.max(0, s)) / 100;
  const ll = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs((hh / 60) % 2 - 1));
  const m = ll - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hh < 60) [rp, gp, bp] = [c, x, 0];
  else if (hh < 120) [rp, gp, bp] = [x, c, 0];
  else if (hh < 180) [rp, gp, bp] = [0, c, x];
  else if (hh < 240) [rp, gp, bp] = [0, x, c];
  else if (hh < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return [
    Math.min(255, Math.max(0, Math.round((rp + m) * 255))),
    Math.min(255, Math.max(0, Math.round((gp + m) * 255))),
    Math.min(255, Math.max(0, Math.round((bp + m) * 255))),
  ];
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Deterministic saturated gradient for a bank key (used until DB row exists).
 * @param {string} bankKey
 * @returns {{ primaryHex: string; secondaryHex: string }}
 */
export function gradientFromBankKey(bankKey) {
  const buf = crypto.createHash("sha256").update(String(bankKey || "default")).digest();
  const h1 = buf.readUInt16BE(0) % 360;
  const spread = 18 + (buf.readUInt16BE(2) % 42);
  const h2 = (h1 + spread) % 360;
  const primaryHex = rgbToHex(...hslToRgb(h1, 70, 44));
  const secondaryHex = rgbToHex(...hslToRgb(h2, 62, 58));
  return { primaryHex, secondaryHex };
}

/**
 * Load or create persisted colors for this bank key (same key → same colors forever).
 * @param {string} bankKey
 */
export async function getOrCreateBankCardTheme(bankKey) {
  const key = String(bankKey || "").trim() || "unknown-issuer";
  await connectDB();

  const existing = await BankCardTheme.findOne({ bankKey: key }).select("primaryHex secondaryHex").lean();
  if (existing?.primaryHex && existing?.secondaryHex) {
    return { primaryHex: existing.primaryHex, secondaryHex: existing.secondaryHex };
  }

  const { primaryHex, secondaryHex } = gradientFromBankKey(key);
  try {
    await BankCardTheme.create({ bankKey: key, primaryHex, secondaryHex });
  } catch (e) {
    if (e?.code !== 11000) throw e;
  }

  const doc = await BankCardTheme.findOne({ bankKey: key }).select("primaryHex secondaryHex").lean();
  if (doc?.primaryHex && doc?.secondaryHex) {
    return { primaryHex: doc.primaryHex, secondaryHex: doc.secondaryHex };
  }
  return { primaryHex, secondaryHex };
}

/**
 * @param {Array<{ issuingBankKey?: string }>} payloads
 */
export async function attachBankThemesToCards(payloads) {
  const list = Array.isArray(payloads) ? payloads : [];
  const keys = [...new Set(list.map((p) => String(p?.issuingBankKey || "").trim()).filter(Boolean))];
  const map = Object.create(null);
  await Promise.all(
    keys.map(async (k) => {
      map[k] = await getOrCreateBankCardTheme(k);
    })
  );
  return list.map((p) => {
    const k = String(p?.issuingBankKey || "").trim() || "unknown-issuer";
    return {
      ...p,
      bankTheme: map[k] || gradientFromBankKey(k),
    };
  });
}
