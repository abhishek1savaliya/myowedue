"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Eye, EyeOff, LoaderCircle } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";
import ModalPortal from "@/components/ModalPortal";
import VirtualCreditCard from "@/components/VirtualCreditCard";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { CACHE_KEYS } from "@/lib/cache-keys";
import { refreshAppCache } from "@/lib/refresh-app-cache";

const initialForm = {
  cardNumber: "",
  nameOnCard: "",
  expiryMonth: "",
  expiryYear: "",
  cvv: "",
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

function formatCVVInput(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 4);
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

const PLATE_DEFAULT_THEME = { primaryHex: "#3b79e1", secondaryHex: "#5c94f0" };

/** Entry card corner radius (mm), scaled with ~22% larger entry surface vs ID-1 width. */
const ENTRY_CARD_CORNER_MM = 3.88;

function bankMarkLetter(name) {
  const t = String(name || "?").trim();
  if (!t) return "?";
  const ch = [...t][0];
  return ch.toUpperCase();
}

function bankTitleUpper(name) {
  const n = String(name || "ISSUER").trim().toUpperCase();
  if (!n) return "ISSUER";
  return n.length > 22 ? `${n.slice(0, 20)}…` : n;
}

function getNetworkLabel(network) {
  return network || "Card";
}

function buildDetectedDetails(source) {
  if (!source) return null;

  return {
    issuingBankKey: source.issuingBankKey || "",
    cardTypeLabel: source.cardTypeLabel || source.metadata?.type || "Payment Card",
    issuingBankName: source.issuingBankName || source.metadata?.issuer || "Unknown Issuer",
    issuingCountryName: source.issuingCountryName || source.metadata?.countryName || "Unknown",
    variantLabel: source.variantLabel || source.metadata?.tier || "Card",
    network: source.network || source.metadata?.scheme || "Card",
    bankTheme: source.bankTheme || null,
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
  const { data, loading, refresh } = useCachedFetch(CACHE_KEYS.cards, "/api/cards");
  const cards = useMemo(() => data?.cards || [], [data]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [revealedCards, setRevealedCards] = useState({});
  const [revealedCardDetails, setRevealedCardDetails] = useState({});
  const [revealTimers, setRevealTimers] = useState({});
  /** When true, the card’s back face (full details) is shown with a 3D flip. */
  const [cardFlipOpen, setCardFlipOpen] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, cardId: "", deleting: false });
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

  function invalidateAfterMutation() {
    refreshAppCache(["cards"]);
    refresh();
  }

  useEffect(() => {
    return () => {
      Object.values(revealTimers).forEach((timerId) => {
        if (timerId) clearTimeout(timerId);
      });
    };
  }, []);

  const normalizedCardNumber = normalizeCardNumberInput(form.cardNumber);
  const editingCard = cards.find((card) => card.id === editingId) || null;
  const detectedDetails = buildDetectedDetails(binLookup.data) || buildDetectedDetails(editingCard);

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
    invalidateAfterMutation();
  }

  function startEdit(card) {
    setEditingId(card.id);
    setForm({
      cardNumber: "",
      nameOnCard: card.nameOnCard || "",
      expiryMonth: card.expiryMonth || "",
      expiryYear: card.expiryYear || "",
      cvv: "",
      privateNote: card.privateNote || "",
    });
    setFieldErrors({});
    setMessage(
      card.hasStoredCardNumber
        ? "Leave the card number blank to keep the existing stored card number and issuer details."
        : "Re-enter the full card number to enable secure full-number reveal for this card."
    );
    setBinLookup({
      status: "success",
      message: "Showing issuer from your saved card.",
      data: {
        issuingBankKey: card.issuingBankKey,
        issuingBankName: card.issuingBankName,
        issuingCountryName: card.issuingCountryName,
        issuingCountryCode: card.issuingCountryCode,
        cardTypeLabel: card.cardTypeLabel,
        variantLabel: card.variantLabel,
        network: card.network,
        bankTheme: card.bankTheme || PLATE_DEFAULT_THEME,
        metadata: {
          scheme: card.network,
          type: card.cardTypeLabel,
          tier: card.variantLabel,
          issuer: card.issuingBankName,
          countryName: card.issuingCountryName,
        },
      },
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

  function promptDeleteCard(id) {
    setDeleteConfirm({ open: true, cardId: id, deleting: false });
  }

  async function confirmDeleteCard() {
    if (!deleteConfirm.cardId) return;
    
    setDeleteConfirm((prev) => ({ ...prev, deleting: true }));
    
    try {
      const res = await fetch(`/api/cards/${deleteConfirm.cardId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        setMessage(data.message || "Failed to delete card.");
        setDeleteConfirm({ open: false, cardId: "", deleting: false });
        return;
      }

      const cardId = deleteConfirm.cardId;
      
      if (editingId === cardId) {
        cancelEdit();
      }

      // Clean up timer
      if (revealTimers[cardId]) {
        clearTimeout(revealTimers[cardId]);
      }

      setRevealedCards((prev) => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
      setRevealedCardDetails((prev) => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
      setRevealTimers((prev) => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
      setCardFlipOpen((prev) => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });

      setDeleteConfirm({ open: false, cardId: "", deleting: false });
      setMessage("Card deleted successfully!");
      
      // Auto-clear success message after 3 seconds
      setTimeout(() => {
        setMessage("");
      }, 3000);
      
      invalidateAfterMutation();
    } catch (error) {
      setMessage("Failed to delete card. Please try again.");
      setDeleteConfirm({ open: false, cardId: "", deleting: false });
    }
  }

  function cancelDeleteConfirm() {
    setDeleteConfirm({ open: false, cardId: "", deleting: false });
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

    // Clean up timer
    if (revealTimers[id]) {
      clearTimeout(revealTimers[id]);
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
    setRevealTimers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setCardFlipOpen((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setMessage(data.message || "Card deleted successfully.");
    invalidateAfterMutation();
  }

  async function copyCardNumber(card) {
    const sessionOpen = Boolean(revealedCards[card.id]);
    const revealedDetails = revealedCardDetails[card.id];
    const valueToCopy =
      sessionOpen && revealedDetails?.cardNumber
        ? formatCardNumberInput(revealedDetails.cardNumber)
        : buildMaskedCardNumber(card.cardNumberLength, card.last4, true);

    setMessage("");
    if (window.navigator?.clipboard?.writeText) {
      await window.navigator.clipboard.writeText(valueToCopy);
      setMessage(sessionOpen && revealedDetails?.cardNumber ? "Full card number copied." : "Masked card number copied.");
      return;
    }

    setMessage(sessionOpen && revealedDetails?.cardNumber ? "Full card number is ready to copy." : "Masked card number is ready to copy.");
  }

  function requestReveal(cardId) {
    if (revealedCards[cardId]) {
      setCardFlipOpen((prev) => ({ ...prev, [cardId]: false }));
      if (revealTimers[cardId]) {
        clearTimeout(revealTimers[cardId]);
      }
      setRevealTimers((prev) => ({ ...prev, [cardId]: null }));
      window.setTimeout(() => {
        setRevealedCards((prev) => ({ ...prev, [cardId]: false }));
      }, 720);
      return;
    }

    if (revealedCardDetails[cardId]?.cardNumber) {
      if (revealTimers[cardId]) {
        clearTimeout(revealTimers[cardId]);
      }
      setRevealedCards((prev) => ({ ...prev, [cardId]: true }));
      setCardFlipOpen((prev) => ({ ...prev, [cardId]: true }));
      const timerId = window.setTimeout(() => {
        setRevealedCards((prev) => ({ ...prev, [cardId]: false }));
        setCardFlipOpen((prev) => ({ ...prev, [cardId]: false }));
        setRevealTimers((prev) => ({ ...prev, [cardId]: null }));
      }, 180000);
      setRevealTimers((prev) => ({ ...prev, [cardId]: timerId }));
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

    const cid = passwordModal.cardId;
    if (data?.card) {
      setRevealedCardDetails((prev) => ({ ...prev, [cid]: data.card }));
    }
    if (revealTimers[cid]) {
      clearTimeout(revealTimers[cid]);
    }
    setCardFlipOpen((prev) => ({ ...prev, [cid]: false }));
    setRevealedCards((prev) => ({ ...prev, [cid]: true }));

    const timerId = window.setTimeout(() => {
      setRevealedCards((prev) => ({ ...prev, [cid]: false }));
      setCardFlipOpen((prev) => ({ ...prev, [cid]: false }));
      setRevealTimers((prev) => ({ ...prev, [cid]: null }));
    }, 180000);
    setRevealTimers((prev) => ({ ...prev, [cid]: timerId }));

    closePasswordModal();

    window.setTimeout(() => {
      setCardFlipOpen((prev) => ({ ...prev, [cid]: true }));
    }, 140);
  }

  const previewTitle = detectedDetails?.issuingBankName || "Issuer Pending";
  const previewTheme = detectedDetails?.bankTheme || PLATE_DEFAULT_THEME;

  const entryCardBackground = `linear-gradient(148deg, ${previewTheme.primaryHex} 0%, ${previewTheme.secondaryHex} 52%, ${previewTheme.primaryHex} 100%)`;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Cards</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          Enter a card number and expiry, and the app will detect issuer details from the first 6 to 8 digits using a cached BIN lookup. Full card numbers stay encrypted at rest and can be revealed only after password confirmation, while CVV stays excluded.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mx-auto grid w-full max-w-2xl gap-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5"
      >
          <div
            className="relative mx-auto flex w-full max-w-[min(100%,112mm)] flex-col overflow-hidden px-4 pb-4 pt-3.5 text-white shadow-[0_14px_40px_rgba(15,23,42,0.2)] sm:px-5 sm:pb-5 sm:pt-4"
            style={{
              background: entryCardBackground,
              borderRadius: `${ENTRY_CARD_CORNER_MM}mm`,
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.18]"
              style={{
                backgroundImage: [
                  "radial-gradient(circle at 72% 88%, rgba(255,255,255,0.42) 0%, transparent 40%)",
                  "radial-gradient(circle at 56% 68%, rgba(255,255,255,0.24) 0%, transparent 34%)",
                  "radial-gradient(circle at 42% 48%, rgba(255,255,255,0.16) 0%, transparent 28%)",
                  "radial-gradient(circle at 22% 22%, rgba(255,255,255,0.1) 0%, transparent 24%)",
                ].join(", "),
              }}
            />

            <div className="relative flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/35 bg-white/12 text-xs font-bold text-white shadow-inner shadow-black/10 sm:h-10 sm:w-10 sm:text-sm">
                    {bankMarkLetter(previewTitle)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-bold uppercase tracking-widest text-white/90 sm:text-[11px]">
                      {bankTitleUpper(previewTitle)}
                    </p>
                    {binLookup.status === "loading" ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-[9px] font-medium leading-snug text-white/80 sm:text-[10px]">
                        <LoaderCircle className="h-3 w-3 shrink-0 animate-spin text-white" aria-hidden />
                        <span className="line-clamp-2">{binLookup.message}</span>
                      </p>
                    ) : binLookup.status === "error" ? (
                      <p className="mt-0.5 text-[9px] font-medium leading-snug text-red-100 sm:text-[10px]">{binLookup.message}</p>
                    ) : detectedDetails &&
                      (binLookup.status === "success" || (editingId && binLookup.status === "idle")) ? (
                      <p className="mt-0.5 line-clamp-2 text-[8px] font-medium leading-snug text-white/80 sm:text-[9px]">
                        <span className="text-white/90">{detectedDetails.issuingCountryName}</span>
                        <span className="text-white/40"> · </span>
                        <span className="text-amber-200/95">{detectedDetails.cardTypeLabel}</span>
                        <span className="text-white/40"> · </span>
                        <span className="text-emerald-200/95">{detectedDetails.variantLabel}</span>
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/65 sm:text-[10px]">
                        {editingId ? "Update on card" : "Type on card"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {binLookup.status === "loading" ? (
                    <LoaderCircle className="h-4 w-4 animate-spin text-white/90" aria-hidden />
                  ) : (
                    <p className="text-right text-[9px] font-semibold uppercase tracking-wider text-cyan-200/95 sm:text-[10px]">
                      {detectedDetails?.network || "Card"}
                    </p>
                  )}
                </div>
              </div>

              <label className="relative mt-4 block sm:mt-5">
                <span className="sr-only">Card number</span>
                <input
                  required={!editingId}
                  value={form.cardNumber ?? ""}
                  onChange={(e) => updateFormField("cardNumber", formatCardNumberInput(e.target.value))}
                  placeholder={editingId ? "New number (optional)" : "0000 0000 0000 0000"}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  className="w-full min-w-0 border-0 border-b border-white/40 bg-white/10 px-2 py-2.5 font-mono text-base font-semibold tracking-[0.14em] text-white caret-white placeholder:text-white/40 outline-none ring-0 transition focus:border-white focus:bg-white/16 sm:text-lg sm:tracking-[0.16em]"
                />
              </label>

              <div className="relative mt-4 grid grid-cols-1 gap-5 sm:mt-5 sm:grid-cols-2 sm:items-end sm:gap-6">
                <div className="min-w-0">
                  <label className="block text-[9px] font-semibold uppercase tracking-wider text-white/70 sm:text-[10px]" htmlFor="card-cvv">
                    Security code <span className="font-normal normal-case text-white/50">(optional)</span>
                  </label>
                  <input
                    id="card-cvv"
                    value={form.cvv ?? ""}
                    onChange={(e) => updateFormField("cvv", formatCVVInput(e.target.value))}
                    placeholder="3 or 4 digits"
                    title="Saved encrypted. Never stored in plain text."
                    inputMode="numeric"
                    maxLength="4"
                    autoComplete="cc-csc"
                    className="mt-2 w-full min-w-0 border-0 border-b border-white/40 bg-white/10 px-2 py-2.5 font-mono text-base font-semibold tracking-[0.14em] text-white caret-white placeholder:text-white/40 outline-none ring-0 transition focus:border-white focus:bg-white/16 sm:text-lg sm:tracking-[0.16em]"
                  />
                  <p className="sr-only">Saved encrypted. Never stored in plain text.</p>
                  <p className="mt-1.5 text-[8px] leading-snug text-white/55 sm:text-[9px]" aria-hidden>
                    Encrypted at rest, not plain text.
                  </p>
                </div>

                <div className="flex flex-col sm:items-end">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-white/65 sm:text-[10px]">Valid thru</span>
                  <div className="mt-2 flex items-center gap-1.5">
                    <label className="sr-only" htmlFor="card-expiry-month">
                      Expiry month
                    </label>
                    <input
                      id="card-expiry-month"
                      required
                      value={form.expiryMonth ?? ""}
                      onChange={(e) => updateFormField("expiryMonth", formatExpiryMonthInput(e.target.value))}
                      placeholder="MM"
                      inputMode="numeric"
                      autoComplete="cc-exp-month"
                      maxLength={2}
                      className={`w-11 border-0 border-b bg-white/10 px-0 py-1.5 text-center font-mono text-sm font-semibold tracking-wider text-white placeholder:text-white/40 outline-none ring-0 transition focus:bg-white/16 sm:w-12 sm:text-base ${
                        fieldErrors.expiryMonth ? "border-red-300 focus:border-red-200" : "border-white/40 focus:border-white"
                      }`}
                    />
                    <span className="pb-1 font-mono text-sm text-white/55" aria-hidden>
                      /
                    </span>
                    <label className="sr-only" htmlFor="card-expiry-year">
                      Expiry year
                    </label>
                    <input
                      id="card-expiry-year"
                      required
                      value={form.expiryYear ?? ""}
                      onChange={(e) => updateFormField("expiryYear", formatExpiryYearInput(e.target.value))}
                      placeholder="YY"
                      inputMode="numeric"
                      autoComplete="cc-exp-year"
                      maxLength={2}
                      className={`w-11 border-0 border-b bg-white/10 px-0 py-1.5 text-center font-mono text-sm font-semibold tracking-wider text-white placeholder:text-white/40 outline-none ring-0 transition focus:bg-white/16 sm:w-12 sm:text-base ${
                        fieldErrors.expiryYear ? "border-red-300 focus:border-red-200" : "border-white/40 focus:border-white"
                      }`}
                    />
                  </div>
                  {fieldErrors.expiryMonth || fieldErrors.expiryYear ? (
                    <p className="mt-1 max-w-56 text-right text-[10px] text-red-200 sm:text-xs">
                      {[fieldErrors.expiryMonth, fieldErrors.expiryYear].filter(Boolean).join(" ")}
                    </p>
                  ) : null}
                </div>
              </div>

              <label className="relative mt-4 block min-w-0 sm:mt-5">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-white/65 sm:text-[10px]">Name on card</span>
                <input
                  value={form.nameOnCard ?? ""}
                  onChange={(e) => updateFormField("nameOnCard", e.target.value)}
                  placeholder="Optional"
                  autoComplete="cc-name"
                  className="mt-1 w-full border-0 border-b border-white/40 bg-white/10 px-0 py-1.5 text-xs font-medium uppercase tracking-wide text-white placeholder:normal-case placeholder:text-white/40 outline-none ring-0 transition focus:border-white focus:bg-white/16 sm:text-sm"
                />
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600" htmlFor="card-private-note">
              Private note (optional)
            </label>
            <textarea
              id="card-private-note"
              value={form.privateNote ?? ""}
              onChange={(e) => updateFormField("privateNote", e.target.value)}
              placeholder="Reminders only — do not store CVV here"
              maxLength={1000}
              rows={3}
              className="w-full rounded-xl border border-zinc-300 bg-zinc-50/80 px-3 py-2.5 text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400"
            />
            <p className="text-xs text-zinc-500">Saved encrypted for your account.</p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            All card details including card number and CVV are saved encrypted in your account. They can only be viewed after password confirmation and will automatically hide after 3 minutes.
          </div>

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

      {loading ? (
        <Loader />
      ) : cards.length === 0 ? (
        <EmptyState text="No cards added yet." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const sessionOpen = Boolean(revealedCards[card.id]);
            const revealedDetails = revealedCardDetails[card.id];
            const flipOpen = Boolean(cardFlipOpen[card.id]);

            const frontMasked = buildMaskedCardNumber(card.cardNumberLength, card.last4, false);
            const backNumber = revealedDetails?.cardNumber
              ? formatCardNumberInput(revealedDetails.cardNumber)
              : frontMasked;
            const backCvv =
              sessionOpen && revealedDetails?.cvv ? String(revealedDetails.cvv) : "•••";

            const cardTheme = card.bankTheme || PLATE_DEFAULT_THEME;
            const nameLine = [card.nameOnCard || "Stored without cardholder name", card.privateNote ? `Note: ${card.privateNote}` : ""]
              .filter(Boolean)
              .join(" · ");

            const disclaimerText = !card.hasStoredCardNumber
              ? "Full number unavailable for this older card until you edit and save it again."
              : "Encrypted in OWE DUE. Use the eye to unlock, then flip shows full details.";

            const actionRow = (
              <>
                <button
                  type="button"
                  onClick={() => copyCardNumber(card)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  {sessionOpen && revealedDetails?.cardNumber ? "Copy Number" : "Copy Masked"}
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
                  onClick={() => promptDeleteCard(card.id)}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white"
                >
                  Delete
                </button>
              </>
            );

            return (
              <div key={card.id} className="min-w-0" style={{ perspective: "1400px" }}>
                <div
                  className="relative mx-auto aspect-[85.6/53.98] w-full max-w-[85.6mm]"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: flipOpen ? "rotateY(180deg)" : "rotateY(0deg)",
                    transition: "transform 0.72s cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                >
                  <div
                    className="absolute inset-0 h-full w-full"
                    style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                  >
                    <VirtualCreditCard
                      fillContainer
                      primaryHex={cardTheme.primaryHex}
                      secondaryHex={cardTheme.secondaryHex}
                      bankName={card.issuingBankName}
                      badgeText="Virtual Card"
                      cardNumberDisplay={frontMasked}
                      cvvDisplay="•••"
                      expiryDisplay={`${card.expiryMonth || "**"}/${card.expiryYear || "**"}`}
                      cardTypeTag={String(card.cardTypeLabel || "CARD").toUpperCase()}
                      networkLine={getNetworkLabel(card.network)}
                      countryLine={card.issuingCountryName}
                      nameLine={nameLine}
                      disclaimer={disclaimerText}
                      revealButton={{
                        onClick: () => requestReveal(card.id),
                        revealed: false,
                        disabled: !card.hasStoredCardNumber,
                        title: !card.hasStoredCardNumber
                          ? "Save a full card number on this record to enable reveal"
                          : revealedDetails?.cardNumber
                            ? "View full card details (flip)"
                            : "Unlock with your password",
                      }}
                    >
                      {actionRow}
                    </VirtualCreditCard>
                  </div>

                  <div
                    className="absolute inset-0 h-full w-full"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <VirtualCreditCard
                      fillContainer
                      primaryHex={cardTheme.primaryHex}
                      secondaryHex={cardTheme.secondaryHex}
                      bankName={card.issuingBankName}
                      badgeText="Details"
                      cardNumberDisplay={backNumber}
                      cvvDisplay={backCvv}
                      expiryDisplay={`${card.expiryMonth || "**"}/${card.expiryYear || "**"}`}
                      cardTypeTag={String(card.cardTypeLabel || "CARD").toUpperCase()}
                      networkLine={getNetworkLabel(card.network)}
                      countryLine={card.issuingCountryName}
                      nameLine={nameLine}
                      disclaimer="Sensitive view — tap the eye to flip back. Auto-hides after 3 minutes."
                      revealButton={{
                        onClick: () => requestReveal(card.id),
                        revealed: true,
                        disabled: false,
                        title: "Flip back to masked card",
                      }}
                    >
                      {actionRow}
                    </VirtualCreditCard>
                  </div>
                </div>
              </div>
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
              Enter your login password to reveal the full card number and CVV. Details will automatically hide after 3 minutes.
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

      {deleteConfirm.open ? (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-black">Delete Card</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Are you sure you want to delete this card? This action cannot be undone.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={cancelDeleteConfirm}
                disabled={deleteConfirm.deleting}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCard}
                disabled={deleteConfirm.deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleteConfirm.deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      ) : null}
    </div>
  );
}
