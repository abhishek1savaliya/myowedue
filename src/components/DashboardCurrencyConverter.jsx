"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { DEFAULT_FX } from "@/lib/currency";

const PAIRS = [
  { code: "AUD", country: "Australia" },
  { code: "USD", country: "United States" },
  { code: "INR", country: "India" },
  { code: "EUR", country: "Euro area" },
  { code: "GBP", country: "United Kingdom" },
];

function countryFor(code) {
  return PAIRS.find((p) => p.code === code)?.country || code;
}

function parseAmount(raw) {
  if (raw == null) return NaN;
  const s = String(raw).replace(/,/g, "").trim();
  if (s === "" || s === "-" || s === "." || s === "-.") return NaN;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

function formatConverted(n) {
  if (!Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  const maxFd = abs > 0 && abs < 0.01 ? 6 : abs < 1 ? 4 : 2;
  const rounded = Number(n.toFixed(maxFd));
  return String(rounded);
}

function formatRateLine(n) {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const maxFd = abs >= 100 ? 2 : abs >= 10 ? 2 : abs >= 1 ? 2 : 4;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFd,
    useGrouping: false,
  });
}

function crossRate(rates, from, to) {
  const f = Number(rates?.[from] ?? 1);
  const t = Number(rates?.[to] ?? 1);
  if (!f || !t) return 1;
  return t / f;
}

const selectClass =
  "w-full appearance-none rounded-xl border border-zinc-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-zinc-900 shadow-sm outline-none ring-teal-500/20 transition focus:border-teal-400 focus:ring-2 disabled:cursor-wait disabled:opacity-60";

export default function DashboardCurrencyConverter() {
  const [rates, setRates] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [leftCode, setLeftCode] = useState("AUD");
  const [rightCode, setRightCode] = useState("INR");
  const [leftStr, setLeftStr] = useState("1");
  const [rightStr, setRightStr] = useState("");
  const leftStrRef = useRef(leftStr);
  leftStrRef.current = leftStr;

  const effectiveRates = rates || DEFAULT_FX;

  const rate = useMemo(
    () => crossRate(effectiveRates, leftCode, rightCode),
    [effectiveRates, leftCode, rightCode]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRatesLoading(true);
      try {
        const res = await fetch("/api/exchange-rates", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && json?.rates && typeof json.rates === "object") {
          setRates(json.rates);
        } else {
          setRates(DEFAULT_FX);
        }
      } catch {
        if (!cancelled) setRates(DEFAULT_FX);
      } finally {
        if (!cancelled) setRatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const n = parseAmount(leftStrRef.current);
    const safeLeft = Number.isFinite(n) ? n : 1;
    if (leftCode === rightCode) {
      setRightStr(formatConverted(safeLeft));
      return;
    }
    const r = crossRate(effectiveRates, leftCode, rightCode);
    setRightStr(formatConverted(safeLeft * r));
  }, [leftCode, rightCode, effectiveRates]);

  const rateLine =
    leftCode === rightCode
      ? `1 ${leftCode} = 1.00 ${rightCode}`
      : `1 ${leftCode} = ${formatRateLine(rate)} ${rightCode}`;

  const countryLine = `${countryFor(leftCode)} → ${countryFor(rightCode)}`;

  function onLeftChange(e) {
    const v = e.target.value;
    setLeftStr(v);
    const n = parseAmount(v);
    if (!Number.isFinite(n)) {
      setRightStr("");
      return;
    }
    if (leftCode === rightCode) {
      setRightStr(formatConverted(n));
      return;
    }
    const r = crossRate(effectiveRates, leftCode, rightCode);
    setRightStr(formatConverted(n * r));
  }

  function onRightChange(e) {
    const v = e.target.value;
    setRightStr(v);
    const n = parseAmount(v);
    if (!Number.isFinite(n)) {
      setLeftStr("");
      return;
    }
    if (leftCode === rightCode) {
      setLeftStr(formatConverted(n));
      return;
    }
    const r = crossRate(effectiveRates, leftCode, rightCode);
    if (!r) return;
    setLeftStr(formatConverted(n / r));
  }

  function Chevron() {
    return (
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden>
        ▾
      </span>
    );
  }

  return (
    <section
      className="rounded-2xl border border-teal-200/90 bg-linear-to-br from-teal-50/70 via-white to-white p-4 shadow-sm"
      aria-label="Currency conversion"
    >
      <div className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 sm:gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <label className="sr-only" htmlFor="convert-left-currency">
            Left currency
          </label>
          <div className="relative w-full min-w-0">
            <select
              id="convert-left-currency"
              value={leftCode}
              onChange={(e) => setLeftCode(e.target.value)}
              disabled={ratesLoading}
              className={selectClass}
            >
              {PAIRS.map(({ code, country }) => (
                <option key={code} value={code}>
                  {code} — {country}
                </option>
              ))}
            </select>
            <Chevron />
          </div>
          <label className="sr-only" htmlFor="convert-amount-left">
            Amount in {leftCode}
          </label>
          <input
            id="convert-amount-left"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={leftStr}
            onChange={onLeftChange}
            disabled={ratesLoading}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-right font-medium tabular-nums text-zinc-900 shadow-inner outline-none ring-teal-500/30 transition focus:border-teal-400 focus:ring-2 disabled:opacity-60"
            placeholder="0"
          />
        </div>

        <div className="flex max-w-[4.75rem] min-w-0 flex-col items-center justify-center gap-1 self-center px-0.5 sm:max-w-[8.5rem] sm:px-2">
          <ArrowRightLeft className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
          <p
            className="w-full text-center text-[10px] font-semibold leading-snug text-zinc-800 sm:text-xs"
            title={`${rateLine} · ${countryLine}`}
          >
            {rateLine}
          </p>
          <p className="hidden w-full text-center text-[11px] leading-snug text-zinc-500 sm:block">{countryLine}</p>
          {ratesLoading ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Rates…
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <label className="sr-only" htmlFor="convert-right-currency">
            Right currency
          </label>
          <div className="relative w-full min-w-0">
            <select
              id="convert-right-currency"
              value={rightCode}
              onChange={(e) => setRightCode(e.target.value)}
              disabled={ratesLoading}
              className={selectClass}
            >
              {PAIRS.map(({ code, country }) => (
                <option key={code} value={code}>
                  {code} — {country}
                </option>
              ))}
            </select>
            <Chevron />
          </div>
          <label className="sr-only" htmlFor="convert-amount-right">
            Amount in {rightCode}
          </label>
          <input
            id="convert-amount-right"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={rightStr}
            onChange={onRightChange}
            disabled={ratesLoading}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-right font-medium tabular-nums text-zinc-900 shadow-inner outline-none ring-teal-500/30 transition focus:border-teal-400 focus:ring-2 disabled:opacity-60"
            placeholder="0"
          />
        </div>
      </div>
    </section>
  );
}
