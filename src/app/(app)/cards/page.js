"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Eye, EyeOff, LoaderCircle } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";
import ModalPortal from "@/components/ModalPortal";

const initialForm = {
  cardNumber: "",
  nameOnCard: "",
  expiryMonth: "",
  expiryYear: "",
  privateNote: "",
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

function resolveLookupBin(value) {
  const digits = normalizeCardNumberInput(value);
  if (digits.length >= 8) return digits.slice(0, 8);
  if (digits.length >= 6) return digits.slice(0, 6);
  return "";
}

function buildMaskedCardNumber(length, last4, revealLast4) {
  const safeLength = Math.max(12, Math.min(Number(length || 16), 19));
  const hiddenDigits = Math.max(safeLength - 4, 8);
  const hidden = "*".repeat(hiddenDigits);
  const safeLast4 = String(last4 || "****").slice(-4).padStart(4, "*");
  const raw = `${hidden}${revealLast4 ? safeLast4 : "****"}`;
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
  return network || "Card";
}

function buildDetectedDetails(source) {
  if (!source) return null;

  return {
    cardTypeLabel: source.cardTypeLabel || source.metadata?.type || "Payment Card",
    issuingBankName: source.issuingBankName || source.metadata?.issuer || "Unknown Issuer",
    issuingCountryName: source.issuingCountryName || source.metadata?.countryName || "Unknown",
    variantLabel: source.variantLabel || source.metadata?.tier || "Card",
    network: source.network || source.metadata?.scheme || "Card",
    metadata: {
      scheme: source.metadata?.scheme || source.network || "Card",
      type: source.metadata?.type || source.cardTypeLabel || "Payment Card",
      tier: source.metadata?.tier || source.variantLabel || "Card",
      issuer: source.metadata?.issuer || source.issuingBankName || "Unknown Issuer",
      countryName: source.metadata?.countryName || source.issuingCountryName || "Unknown",
    },
  };
}

export default function CardsPage() {
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
  const [binLookup, setBinLookup] = useState({
    status: "idle",
    message: "Enter at least the first 6 digits to detect the card details automatically.",
    data: null,
    lookupBin: "",
  });
  const lastLookupBinRef = useRef("");

  async function load() {
    setLoading(true);
    const cardsRes = await fetch("/api/cards", { cache: "no-store" });
    const cardsData = await cardsRes.json().catch(() => ({}));

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

  const normalizedCardNumber = normalizeCardNumberInput(form.cardNumber);
  const editingCard = cards.find((card) => card.id === editingId) || null;
  const detectedDetails = buildDetectedDetails(binLookup.data) || buildDetectedDetails(editingCard);
  const showDetectedDetails = binLookup.status !== "idle" || Boolean(detectedDetails);

  useEffect(() => {
    if (normalizedCardNumber.length < 6) {
      lastLookupBinRef.current = "";
      setBinLookup(
        editingCard
          ? {
              status: "idle",
              message: "Enter a new card number to refresh the detected details, or leave it blank to keep the current issuer data.",
              data: null,
              lookupBin: "",
            }
          : {
              status: "idle",
              message: "Enter at least the first 6 digits to detect the card details automatically.",
              data: null,
              lookupBin: "",
            }
      );
      return;
    }

    const lookupBin = resolveLookupBin(normalizedCardNumber);
    if (!lookupBin || lookupBin === lastLookupBinRef.current) {
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      lastLookupBinRef.current = lookupBin;
      setBinLookup((prev) => ({
        status: "loading",
        message: "Detecting issuer details from the BIN...",
        data: prev.lookupBin === lookupBin ? prev.data : null,
        lookupBin,
      }));

      const res = await fetch(`/api/cards/bin?number=${encodeURIComponent(normalizedCardNumber)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!active) return;

      if (!res.ok) {
        setBinLookup({
          status: "error",
          message: data.message || "Could not detect card details for those digits.",
          data: null,
          lookupBin,
        });
        return;
      }

      setBinLookup({
        status: "success",
        message: "Card details detected automatically.",
        data,
        lookupBin: data.lookupBin || lookupBin,
      });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [editingCard, normalizedCardNumber]);

  function updateFormField(field, value) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      return { ...prev, [field]: "" };
    });
    setMessage("");
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setMessage("");
    setFieldErrors({});

    const url = editingId ? `/api/cards/${editingId}` : "/api/cards";
    const method = editingId ? "PUT" : "POST";
    const payload = {
      ...form,
      cardNumber: normalizedCardNumber,
    };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      const nextMessage = data.message || "Failed to save card.";
      if (nextMessage === "Enter a valid expiry month") {
        setFieldErrors({ expiryMonth: nextMessage });
      } else if (nextMessage === "Enter a valid expiry year") {
        setFieldErrors({ expiryYear: nextMessage });
      } else {
        setMessage(nextMessage);
      }
      return;
    }

    setForm(initialForm);
    setEditingId("");
    setFieldErrors({});
    setBinLookup({
      status: "idle",
      message: "Enter at least the first 6 digits to detect the card details automatically.",
      data: null,
      lookupBin: "",
    });
    lastLookupBinRef.current = "";
    setMessage(data.message || (editingId ? "Card updated successfully." : "Card added successfully."));
    load();
  }

  function startEdit(card) {
    setEditingId(card.id);
    setForm({
      cardNumber: "",
      nameOnCard: card.nameOnCard || "",
      expiryMonth: card.expiryMonth || "",
      expiryYear: card.expiryYear || "",
      privateNote: card.privateNote || "",
    });
    setFieldErrors({});
    setMessage(
      card.hasStoredCardNumber
        ? "Leave the card number blank to keep the existing stored card number and issuer details."
        : "Re-enter the full card number to enable secure full-number reveal for this card."
    );
    setBinLookup({
      status: "idle",
      message: "Enter a new card number to refresh the detected details, or leave it blank to keep the current issuer data.",
      data: null,
      lookupBin: "",
    });
    lastLookupBinRef.current = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId("");
    setForm(initialForm);
    setMessage("");
    setFieldErrors({});
    setBinLookup({
      status: "idle",
      message: "Enter at least the first 6 digits to detect the card details automatically.",
      data: null,
      lookupBin: "",
    });
    lastLookupBinRef.current = "";
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
    if (window.navigator?.clipboard?.writeText) {
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

  const previewDigits = normalizedCardNumber;
  const previewLast4 = previewDigits ? previewDigits.slice(-4).padStart(4, "*") : "****";
  const previewLength = previewDigits.length >= 12 ? previewDigits.length : 16;
  const previewNumber = buildMaskedCardNumber(previewLength, previewLast4, true);
  const previewNetwork = detectedDetails?.network || "Card";
  const previewTitle = detectedDetails?.issuingBankName || "Issuer Pending";
  const previewSubtitle = detectedDetails?.variantLabel || detectedDetails?.cardTypeLabel || "Detected after 6 digits";
  const previewExpiry = `${form.expiryMonth.padEnd(2, "*")}/${form.expiryYear.padEnd(2, "*")}`;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Cards</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          Enter a card number and expiry, and the app will detect issuer details from the first 6 to 8 digits using a cached BIN lookup. Full card numbers stay encrypted at rest and can be revealed only after password confirmation, while CVV stays excluded.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <input
                required={!editingId}
                value={form.cardNumber ?? ""}
                onChange={(e) => updateFormField("cardNumber", formatCardNumberInput(e.target.value))}
                placeholder={editingId ? "Enter new card number (optional)" : "Card number"}
                inputMode="numeric"
                className="w-full rounded-xl border border-zinc-300 px-3 py-3"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <input
                value={form.nameOnCard ?? ""}
                onChange={(e) => updateFormField("nameOnCard", e.target.value)}
                placeholder="Name on card (optional)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-3"
              />
            </div>

            <div className="space-y-1">
              <input
                required
                value={form.expiryMonth ?? ""}
                onChange={(e) => updateFormField("expiryMonth", formatExpiryMonthInput(e.target.value))}
                placeholder="Expiry month (MM)"
                inputMode="numeric"
                className={`w-full rounded-xl border px-3 py-3 ${fieldErrors.expiryMonth ? "border-red-500 text-red-700" : "border-zinc-300"}`}
              />
              {fieldErrors.expiryMonth ? <p className="text-sm text-red-600">{fieldErrors.expiryMonth}</p> : null}
            </div>

            <div className="space-y-1">
              <input
                required
                value={form.expiryYear ?? ""}
                onChange={(e) => updateFormField("expiryYear", formatExpiryYearInput(e.target.value))}
                placeholder="Expiry year (YY)"
                inputMode="numeric"
                className={`w-full rounded-xl border px-3 py-3 ${fieldErrors.expiryYear ? "border-red-500 text-red-700" : "border-zinc-300"}`}
              />
              {fieldErrors.expiryYear ? <p className="text-sm text-red-600">{fieldErrors.expiryYear}</p> : null}
            </div>

            <div className="space-y-1 md:col-span-2">
              <textarea
                value={form.privateNote ?? ""}
                onChange={(e) => updateFormField("privateNote", e.target.value)}
                placeholder="Private note (optional)"
                maxLength={1000}
                rows={3}
                className="w-full rounded-xl border border-zinc-300 px-3 py-3"
              />
              <p className="text-xs text-zinc-500">Saved encrypted for your account. Good for reminders or card-specific notes, not CVV.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            CVV is intentionally not saved by the app, even though the card record stores the rest of your reference details in encrypted form.
          </div>

          {showDetectedDetails ? (
            <div className="overflow-hidden rounded-3xl border border-slate-800 bg-[linear-gradient(135deg,#0f172a_0%,#172554_55%,#1e293b_100%)] p-4 text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-200/90">Detected Details</p>
                  {binLookup.status !== "idle" ? <p className="mt-2 text-sm text-slate-200/75">{binLookup.message}</p> : null}
                </div>
                {binLookup.status === "loading" ? <LoaderCircle className="mt-0.5 h-4 w-4 animate-spin text-cyan-200" /> : null}
              </div>

              {detectedDetails ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/12 bg-white/6 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300/85">Issuer</p>
                    <p className="mt-2 text-base font-semibold leading-snug text-white">{detectedDetails.issuingBankName}</p>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-white/6 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300/85">Country</p>
                    <p className="mt-2 text-base font-semibold leading-snug text-white">{detectedDetails.issuingCountryName}</p>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-white/6 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300/85">Network</p>
                    <p className="mt-2 text-base font-semibold leading-snug text-cyan-200">{detectedDetails.network}</p>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-white/6 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300/85">Type</p>
                    <p className="mt-2 text-base font-semibold leading-snug text-amber-200">{detectedDetails.cardTypeLabel}</p>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-white/6 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm sm:col-span-2">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300/85">Variant</p>
                    <p className="mt-2 text-base font-semibold leading-snug text-emerald-200">{detectedDetails.variantLabel}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button type="submit" disabled={saving} className="rounded-xl bg-black px-4 py-3 text-white disabled:opacity-60">
              {saving ? "Saving..." : editingId ? "Update Card" : "Add Card"}
            </button>
            {editingId ? (
              <button type="button" onClick={cancelEdit} className="rounded-xl border border-zinc-300 px-4 py-3 text-zinc-700">
                Cancel Edit
              </button>
            ) : null}
            {message ? <p className="text-sm text-zinc-600">{message}</p> : null}
          </div>
        </form>

        <div className={`relative self-start overflow-hidden rounded-[28px] bg-linear-to-br p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.22)] aspect-[1.586/1] min-h-[260px] ${getNetworkAccent(previewNetwork)}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.16),transparent_32%)]" />
          <div className="relative flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">Preview</p>
                <p className="mt-3 text-2xl font-semibold tracking-[0.18em]">{previewNumber}</p>
              </div>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                {getNetworkLabel(previewNetwork)}
              </span>
            </div>

            <div className="mt-auto grid gap-5 pt-10 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Issuer</p>
                <p className="mt-2 text-sm font-semibold tracking-[0.08em]">{previewTitle}</p>
                <p className="mt-2 text-xs text-white/70">{previewSubtitle}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Expires</p>
                <p className="mt-2 text-sm font-semibold tracking-[0.14em]">{previewExpiry}</p>
                <p className="mt-2 text-xs text-white/70">{detectedDetails?.issuingCountryName || "Country pending"}</p>
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

                  <div className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Type</p>
                      <p className="mt-2 font-semibold tracking-[0.08em]">{card.cardTypeLabel}</p>
                      <p className="mt-2 text-xs text-white/75">{card.issuingCountryName}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Expires</p>
                      <p className="mt-2 font-semibold tracking-[0.14em]">{`${card.expiryMonth || "**"}/${card.expiryYear || "**"}`}</p>
                      <p className="mt-2 text-xs text-white/75">{card.nameOnCard || "Stored without cardholder name"}</p>
                      {card.privateNote ? <p className="mt-2 text-xs text-white/75">{card.privateNote}</p> : null}
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
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-black">Confirm Password</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Enter your login password to reveal the full card number. CVV is not collected or stored.
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
                <button type="button" onClick={closePasswordModal} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700">
                  Cancel
                </button>
                <button type="submit" disabled={verifyingPassword} className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-60">
                  {verifyingPassword ? "Checking..." : "Show Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      ) : null}
    </div>
  );
}
