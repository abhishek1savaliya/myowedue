"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";

const initialForm = {
  cardTypeValue: "",
  issuingCountryCode: "",
  issuingBankKey: "",
  variantValue: "",
  network: "",
  nameOnCard: "",
  cardNumber: "",
  expiryMonth: "",
  expiryYear: "",
};

function normalizeCardNumberInput(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 19);
}

function formatCardNumberInput(value) {
  const digits = normalizeCardNumberInput(value);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiryMonthInput(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 2);
}

function formatExpiryYearInput(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 2);
}

function buildMaskedCardNumber(length, last4, revealLast4) {
  const safeLength = Math.max(12, Math.min(Number(length || 16), 19));
  const hiddenDigits = Math.max(safeLength - 4, 8);
  const hidden = "•".repeat(hiddenDigits);
  const safeLast4 = String(last4 || "••••").slice(-4).padStart(4, "•");
  const raw = `${hidden}${revealLast4 ? safeLast4 : "••••"}`;
  return raw.match(/.{1,4}/g)?.join(" ") || raw;
}

function getNetworkAccent(network) {
  const value = String(network || "").toLowerCase();
  if (value.includes("visa")) return "from-blue-700 via-sky-600 to-cyan-400";
  if (value.includes("master")) return "from-orange-500 via-rose-500 to-pink-500";
  if (value.includes("american")) return "from-emerald-700 via-teal-500 to-cyan-400";
  if (value.includes("jcb")) return "from-green-700 via-emerald-500 to-lime-400";
  if (value.includes("diners")) return "from-indigo-700 via-violet-600 to-fuchsia-500";
  return "from-zinc-900 via-zinc-700 to-zinc-500";
}

function getNetworkLabel(network) {
  return network || "Card Network";
}

export default function CardsPage() {
  const [catalog, setCatalog] = useState({ cardTypes: [], countries: [], banks: [] });
  const [cards, setCards] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [revealedCards, setRevealedCards] = useState({});
  const [revealedCardDetails, setRevealedCardDetails] = useState({});
  const [passwordModal, setPasswordModal] = useState({ open: false, cardId: "" });
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  async function load() {
    setLoading(true);
    const [catalogRes, cardsRes] = await Promise.all([
      fetch("/api/cards/catalog", { cache: "no-store" }),
      fetch("/api/cards", { cache: "no-store" }),
    ]);

    const catalogData = await catalogRes.json().catch(() => ({}));
    const cardsData = await cardsRes.json().catch(() => ({}));

    if (catalogRes.ok) {
      setCatalog(catalogData.catalog || { cardTypes: [], countries: [], banks: [] });
    } else {
      setMessage(catalogData.message || "Failed to load card catalog.");
    }

    if (cardsRes.ok) {
      setCards(cardsData.cards || []);
    } else {
      setMessage(cardsData.message || "Failed to load cards.");
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function getAvailableBanks(nextForm = form) {
    return (catalog.banks || []).filter((bank) => {
      if (nextForm.issuingCountryCode && bank.countryCode !== nextForm.issuingCountryCode) return false;
      if (
        nextForm.cardTypeValue &&
        Array.isArray(bank.cardTypes) &&
        bank.cardTypes.length > 0 &&
        !bank.cardTypes.includes(nextForm.cardTypeValue)
      ) {
        return false;
      }
      return true;
    });
  }

  function getSelectedBank(nextForm = form) {
    return getAvailableBanks(nextForm).find((bank) => bank.key === nextForm.issuingBankKey) || null;
  }

  function getAvailableVariants(nextForm = form) {
    return getSelectedBank(nextForm)?.variants || [];
  }

  function updateVariant(nextForm) {
    const variant = getAvailableVariants(nextForm).find((item) => item.value === nextForm.variantValue);
    return {
      ...nextForm,
      network: variant?.network || "",
    };
  }

  function updateFormField(field, value) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      return { ...prev, [field]: "" };
    });

    setForm((prev) => {
      let next = { ...prev, [field]: value };

      if (field === "cardTypeValue" || field === "issuingCountryCode") {
        next = {
          ...next,
          issuingBankKey: "",
          variantValue: "",
          network: "",
        };
      }

      if (field === "issuingBankKey") {
        next = {
          ...next,
          variantValue: "",
          network: "",
        };
      }

      if (field === "variantValue") {
        next = updateVariant(next);
      }

      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setMessage("");
    setFieldErrors({});

    const url = editingId ? `/api/cards/${editingId}` : "/api/cards";
    const method = editingId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        cardNumber: normalizeCardNumberInput(form.cardNumber),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      const nextMessage = data.message || "Failed to save card.";
      if (nextMessage === "Enter a valid expiry month") {
        setFieldErrors({ expiryMonth: nextMessage });
      } else {
        setMessage(nextMessage);
      }
      return;
    }

    setForm(initialForm);
    setEditingId("");
    setFieldErrors({});
    setMessage(data.message || (editingId ? "Card updated successfully." : "Card added successfully."));
    load();
  }

  function startEdit(card) {
    setEditingId(card.id);
    setForm({
      cardTypeValue: card.cardTypeValue || "",
      issuingCountryCode: card.issuingCountryCode || "",
      issuingBankKey: card.issuingBankKey || "",
      variantValue: card.variantValue || "",
      network: card.network || "",
      nameOnCard: card.nameOnCard || "",
      cardNumber: "",
      expiryMonth: card.expiryMonth || "",
      expiryYear: card.expiryYear || "",
    });
    setMessage(
      card.hasStoredCardNumber
        ? "Leave card number blank to keep the existing stored card number."
        : "Re-enter the full card number to enable secure full-number reveal for this card."
    );
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function cancelEdit() {
    setEditingId("");
    setForm(initialForm);
    setMessage("");
    setFieldErrors({});
  }

  function closePasswordModal() {
    setPasswordModal({ open: false, cardId: "" });
    setPasswordInput("");
    setPasswordError("");
    setVerifyingPassword(false);
  }

  async function removeCard(id) {
    const res = await fetch(`/api/cards/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.message || "Failed to delete card.");
      return;
    }

    if (editingId === id) {
      cancelEdit();
    }

    setRevealedCards((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setRevealedCardDetails((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setMessage(data.message || "Card deleted successfully.");
    load();
  }

  async function copyCardNumber(card) {
    const revealedDetails = revealedCardDetails[card.id];
    const valueToCopy = revealedDetails?.cardNumber
      ? formatCardNumberInput(revealedDetails.cardNumber)
      : buildMaskedCardNumber(card.cardNumberLength, card.last4, true);
    setMessage("");
    if (typeof window !== "undefined" && window.navigator?.clipboard?.writeText) {
      await window.navigator.clipboard.writeText(valueToCopy);
      setMessage(revealedDetails?.cardNumber ? "Full card number copied." : "Masked card number copied.");
      return;
    }
    setMessage(revealedDetails?.cardNumber ? "Full card number is ready to copy." : "Masked card number is ready to copy.");
  }

  function requestReveal(cardId) {
    if (revealedCards[cardId]) {
      setRevealedCards((prev) => ({ ...prev, [cardId]: false }));
      return;
    }

    if (revealedCardDetails[cardId]?.cardNumber) {
      setRevealedCards((prev) => ({ ...prev, [cardId]: true }));
      return;
    }

    setPasswordModal({ open: true, cardId });
    setPasswordInput("");
    setPasswordError("");
  }

  async function confirmPasswordAndReveal(e) {
    e.preventDefault();
    if (verifyingPassword || !passwordModal.cardId) return;

    setVerifyingPassword(true);
    setPasswordError("");

    const res = await fetch(`/api/cards/${passwordModal.cardId}/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwordInput }),
    });
    const data = await res.json().catch(() => ({}));
    setVerifyingPassword(false);

    if (!res.ok) {
      setPasswordError(data.message || "Failed to verify password.");
      return;
    }

    if (data?.card) {
      setRevealedCardDetails((prev) => ({ ...prev, [passwordModal.cardId]: data.card }));
    }
    setRevealedCards((prev) => ({ ...prev, [passwordModal.cardId]: true }));
    closePasswordModal();
  }

  const availableBanks = getAvailableBanks();
  const availableVariants = getAvailableVariants();
  const previewDigits = normalizeCardNumberInput(form.cardNumber);
  const previewLast4 = previewDigits ? previewDigits.slice(-4).padStart(4, "•") : "••••";
  const previewLength = previewDigits.length >= 12 ? previewDigits.length : 16;
  const previewNumber = buildMaskedCardNumber(previewLength, previewLast4, true);
  const previewName = form.nameOnCard || "CARDHOLDER NAME";
  const previewExpiry = `${form.expiryMonth.padEnd(2, "•")}/${form.expiryYear.padEnd(2, "•")}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Cards</h1>
        <p className="text-sm text-zinc-600">
          Add and manage card-style records with masked number display, secure full-number reveal, expiry, bank, and network. CVV is never stored.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={handleSubmit} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 md:grid-cols-2">
          <input
            required={!editingId}
            value={form.cardNumber}
            onChange={(e) => updateFormField("cardNumber", formatCardNumberInput(e.target.value))}
            placeholder={editingId ? "Enter new card number (optional)" : "Card number"}
            inputMode="numeric"
            className="rounded-xl border border-zinc-300 px-3 py-2 md:col-span-2"
          />

          <div className="space-y-1">
            <input
              required
              value={form.expiryMonth}
              onChange={(e) => updateFormField("expiryMonth", formatExpiryMonthInput(e.target.value))}
              placeholder="Expiry month (MM)"
              inputMode="numeric"
              className={`w-full rounded-xl border px-3 py-2 ${fieldErrors.expiryMonth ? "border-red-500 text-red-700 focus:border-red-500" : "border-zinc-300"}`}
            />
            {fieldErrors.expiryMonth ? <p className="text-sm text-red-600">{fieldErrors.expiryMonth}</p> : null}
          </div>

          <input
            required
            value={form.expiryYear}
            onChange={(e) => updateFormField("expiryYear", formatExpiryYearInput(e.target.value))}
            placeholder="Expiry year (YY)"
            inputMode="numeric"
            className="rounded-xl border border-zinc-300 px-3 py-2"
          />

          <select
            required
            value={form.cardTypeValue}
            onChange={(e) => updateFormField("cardTypeValue", e.target.value)}
            className="rounded-xl border border-zinc-300 px-3 py-2"
          >
            <option value="">Select card type</option>
            {(catalog.cardTypes || []).map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>

          <select
            required
            value={form.issuingCountryCode}
            onChange={(e) => updateFormField("issuingCountryCode", e.target.value)}
            className="rounded-xl border border-zinc-300 px-3 py-2"
          >
            <option value="">Select issuing country</option>
            {(catalog.countries || []).map((item) => (
              <option key={item.code} value={item.code}>{item.name}</option>
            ))}
          </select>

          <select
            required
            value={form.issuingBankKey}
            onChange={(e) => updateFormField("issuingBankKey", e.target.value)}
            className="rounded-xl border border-zinc-300 px-3 py-2"
            disabled={!form.cardTypeValue || !form.issuingCountryCode}
          >
            <option value="">Select issuing bank</option>
            {availableBanks.map((item) => (
              <option key={item.key} value={item.key}>{item.name}</option>
            ))}
          </select>

          <select
            required
            value={form.variantValue}
            onChange={(e) => updateFormField("variantValue", e.target.value)}
            className="rounded-xl border border-zinc-300 px-3 py-2"
            disabled={!form.issuingBankKey}
          >
            <option value="">Select card variant</option>
            {availableVariants.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>

          <input
            value={form.nameOnCard}
            onChange={(e) => updateFormField("nameOnCard", e.target.value.toUpperCase())}
            placeholder="Name on card (optional)"
            className="rounded-xl border border-zinc-300 px-3 py-2 md:col-span-2"
          />

          <input
            value={form.network}
            readOnly
            placeholder="Network auto-selected"
            className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-600 md:col-span-2"
          />

          <div className="flex flex-col gap-3 md:col-span-2 xl:flex-row xl:items-center">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : editingId ? "Update Card" : "Add Card"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-xl border border-zinc-300 px-4 py-2 text-zinc-700"
              >
                Cancel Edit
              </button>
            ) : null}
            {message ? <p className="text-sm text-zinc-600">{message}</p> : null}
          </div>
        </form>

        <div className={`relative overflow-hidden rounded-[28px] bg-linear-to-br p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.22)] ${getNetworkAccent(form.network)}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.16),transparent_32%)]" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">Preview</p>
                <p className="mt-3 text-2xl font-semibold tracking-[0.18em]">{previewNumber}</p>
              </div>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                {getNetworkLabel(form.network)}
              </span>
            </div>

            <div className="mt-10 flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Cardholder</p>
                <p className="mt-2 text-sm font-semibold tracking-[0.14em]">{previewName}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Expires</p>
                <p className="mt-2 text-sm font-semibold tracking-[0.14em]">{previewExpiry}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : cards.length === 0 ? (
        <EmptyState text="No cards added yet." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const revealed = Boolean(revealedCards[card.id]);
            const revealedDetails = revealedCardDetails[card.id];
            const cardNumberText =
              revealed && revealedDetails?.cardNumber
                ? formatCardNumberInput(revealedDetails.cardNumber)
                : buildMaskedCardNumber(card.cardNumberLength, card.last4, revealed);

            return (
              <article
                key={card.id}
                className={`relative overflow-hidden rounded-[28px] bg-linear-to-br p-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.2)] ${getNetworkAccent(card.network)}`}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.16),transparent_32%)]" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">{card.issuingBankName}</p>
                      <p className="mt-2 text-lg font-semibold">{card.variantLabel}</p>
                    </div>
                    <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
                      {card.network}
                    </span>
                  </div>

                  <p className="mt-8 text-2xl font-semibold tracking-[0.18em]">{cardNumberText}</p>

                  <div className="mt-8 flex items-end justify-between gap-3 text-sm">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Cardholder</p>
                      <p className="mt-2 font-semibold tracking-[0.14em]">{card.nameOnCard || "NOT PROVIDED"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Expires</p>
                      <p className="mt-2 font-semibold tracking-[0.14em]">{`${card.expiryMonth || "••"}/${card.expiryYear || "••"}`}</p>
                    </div>
                  </div>

                  {!card.hasStoredCardNumber ? (
                    <p className="mt-3 text-xs text-white/75">
                      Full number unavailable for this older card until you edit and save it again.
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => requestReveal(card.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white"
                    >
                      {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {revealed ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyCardNumber(card)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {revealed && revealedDetails?.cardNumber ? "Copy Number" : "Copy Masked"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(card)}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCard(card.id)}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {passwordModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-black">Confirm Password</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Enter your login password to reveal the full card number. CVV is never stored.
            </p>

            <form onSubmit={confirmPasswordAndReveal} className="mt-4 space-y-3">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className={`w-full rounded-xl border px-3 py-2 ${passwordError ? "border-red-500 text-red-700" : "border-zinc-300"}`}
              />
              {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingPassword}
                  className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {verifyingPassword ? "Checking..." : "Show Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
