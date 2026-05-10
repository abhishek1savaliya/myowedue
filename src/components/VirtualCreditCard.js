"use client";

import { Eye, EyeOff } from "lucide-react";

/** ISO/IEC 7810 ID-1 (credit card) — width × height */
export const CARD_WIDTH_MM = 85.6;
export const CARD_HEIGHT_MM = 53.98;
export const CARD_CORNER_RADIUS_MM = 3.18;

function bankMarkLetter(name) {
  const t = String(name || "?").trim();
  if (!t) return "?";
  const ch = [...t][0];
  return ch.toUpperCase();
}

function bankTitle(name) {
  const n = String(name || "ISSUER").trim().toUpperCase();
  if (!n) return "ISSUER";
  return n.length > 22 ? `${n.slice(0, 20)}…` : n;
}

/**
 * Virtual card chrome (Plate IQ–style): ISO ID-1 proportions, small type like a physical card.
 * @param {{
 *   primaryHex?: string;
 *   secondaryHex?: string;
 *   bankName: string;
 *   badgeText?: string;
 *   cardNumberDisplay: string;
 *   cvvDisplay?: string;
 *   expiryDisplay: string;
 *   cardTypeTag?: string;
 *   networkLine?: string;
 *   countryLine?: string;
 *   nameLine?: string;
 *   disclaimer?: string;
 *   className?: string;
 *   fillContainer?: boolean;
 *   revealButton?: { onClick: () => void; revealed: boolean; disabled?: boolean; title?: string };
 *   children?: import("react").ReactNode;
 * }} props
 */
export default function VirtualCreditCard({
  primaryHex = "#3b79e1",
  secondaryHex = "#6ba8ff",
  bankName,
  badgeText = "Virtual Card",
  cardNumberDisplay,
  cvvDisplay = "•••",
  expiryDisplay,
  cardTypeTag = "STORED CARD",
  networkLine = "Card",
  countryLine = "",
  nameLine = "",
  disclaimer = "Stored encrypted in OWE DUE. Full number requires your password to reveal.",
  className = "",
  fillContainer = false,
  revealButton = null,
  children,
}) {
  const bg = `linear-gradient(148deg, ${primaryHex} 0%, ${secondaryHex} 52%, ${primaryHex} 100%)`;

  const shellClass = fillContainer
    ? "relative flex h-full w-full min-h-0 flex-col overflow-hidden rounded-[3.18mm] px-[2.8mm] pb-[2.2mm] pt-[2.5mm] text-white shadow-[0_10px_28px_rgba(15,23,42,0.22)] sm:px-[3.2mm] sm:pb-[2.5mm] sm:pt-[2.8mm]"
    : "relative mx-auto flex aspect-[85.6/53.98] w-full max-w-[85.6mm] flex-col overflow-hidden rounded-[3.18mm] px-[2.8mm] pb-[2.2mm] pt-[2.5mm] text-white shadow-[0_10px_28px_rgba(15,23,42,0.22)] sm:px-[3.2mm] sm:pb-[2.5mm] sm:pt-[2.8mm]";

  return (
    <article className={`${shellClass} ${className}`.trim()} style={{ background: bg }}>
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

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/35 bg-white/12 text-[10px] font-bold leading-none text-white shadow-inner shadow-black/10">
              {bankMarkLetter(bankName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[7.5px] font-bold uppercase leading-tight tracking-[0.16em] text-white/88 sm:text-[8px] sm:tracking-[0.18em]">
                {bankTitle(bankName)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {revealButton ? (
              <button
                type="button"
                onClick={revealButton.onClick}
                disabled={revealButton.disabled}
                title={revealButton.title || (revealButton.revealed ? "Hide sensitive details" : "View sensitive details")}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/38 bg-white/18 text-white shadow-sm shadow-black/10 transition hover:bg-white/28 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {revealButton.revealed ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
              </button>
            ) : null}
            <div className="text-right leading-tight">
              <p className="text-[6.5px] font-semibold uppercase tracking-[0.14em] text-white/78 sm:text-[7px] sm:tracking-[0.18em]">
                {badgeText}
              </p>
            </div>
          </div>
        </div>

        <p className="relative mt-2 font-mono text-[11px] font-semibold leading-tight tracking-[0.12em] text-white antialiased sm:mt-2.5 sm:text-[12px] sm:tracking-[0.14em]">
          {cardNumberDisplay}
        </p>

        <div className="relative mt-2 grid grid-cols-2 gap-2 text-[9px] sm:mt-2.5 sm:gap-2.5 sm:text-[10px]">
          <div>
            <p className="text-[6px] font-semibold uppercase tracking-[0.16em] text-white/62 sm:text-[6.5px]">Security code</p>
            <p className="mt-0.5 font-mono text-[10px] font-semibold tracking-[0.12em] text-white sm:text-[11px]">{cvvDisplay}</p>
          </div>
          <div className="text-right">
            <p className="text-[6px] font-semibold uppercase tracking-[0.16em] text-white/62 sm:text-[6.5px]">Valid thru</p>
            <p className="mt-0.5 font-mono text-[10px] font-semibold tracking-[0.1em] text-white sm:text-[11px]">{expiryDisplay}</p>
          </div>
        </div>

        <div className="relative mt-auto flex flex-wrap items-end justify-between gap-1.5 pt-2 sm:pt-2.5">
          <div className="min-w-0 pr-1">
            <p className="text-[6px] font-bold uppercase tracking-[0.2em] text-white/68 sm:text-[6.5px]">{cardTypeTag}</p>
            {countryLine ? <p className="mt-0.5 truncate text-[7px] text-white/72 sm:text-[7.5px]">{countryLine}</p> : null}
            {nameLine ? <p className="mt-0.5 truncate text-[7px] font-medium leading-snug text-white/82 sm:text-[7.5px]">{nameLine}</p> : null}
          </div>
          <div className="text-right">
            <div className="ml-auto flex min-h-8 min-w-8 max-w-[4.25rem] items-center justify-center rounded-full border border-white/32 bg-white/10 px-1 py-0.5 text-center text-[5.5px] font-bold uppercase leading-[1.05] tracking-tight text-white sm:max-w-[4.5rem] sm:text-[6px]">
              <span className="line-clamp-3 break-all">{String(networkLine || "CARD").replace(/\s+/g, " ").trim()}</span>
            </div>
          </div>
        </div>

        <p className="relative mt-1 text-[5.5px] leading-snug text-white/58 sm:mt-1.5 sm:text-[6px]">{disclaimer}</p>

        {children ? (
          <div className="relative mt-1.5 flex flex-wrap gap-1 sm:mt-2 sm:gap-1.5 [&_button]:px-2 [&_button]:py-1 [&_button]:text-[9px] [&_button]:sm:text-[10px]">
            {children}
          </div>
        ) : null}
      </div>
    </article>
  );
}
