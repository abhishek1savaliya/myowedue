"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  COOKIE_CONSENT_ACCEPTED,
  COOKIE_CONSENT_REJECTED,
  getCookieConsentStatus,
  markConsentRejected,
  rememberCurrentUiPreferences,
  setCookieConsentStatus,
} from "@/lib/cookie-preferences";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = getCookieConsentStatus();
    setVisible(!consent);
  }, []);

  function acceptCookies() {
    setCookieConsentStatus(COOKIE_CONSENT_ACCEPTED);
    rememberCurrentUiPreferences();
    setVisible(false);
  }

  function rejectCookies() {
    markConsentRejected();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] px-4 pb-4 sm:px-6">
      <div className="mx-auto max-w-5xl rounded-3xl border border-zinc-200 bg-white/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.14)] backdrop-blur sm:p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-600">
              Cookie Permission
            </p>
            <h2 className="mt-1 text-lg font-semibold text-black sm:text-xl">
              Can we use optional cookies to speed up your experience?
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              We always use necessary cookies for secure sign-in. If you accept optional cookies, we'll
              remember display preferences like theme and typography so the app feels faster on repeat visits.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Read more in our{" "}
              <Link href="/privacy-policy" className="font-semibold text-zinc-700 underline underline-offset-4">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[320px]">
            <button
              type="button"
              onClick={rejectCookies}
              data-consent={COOKIE_CONSENT_REJECTED}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-zinc-300 px-4 py-3 text-center text-sm font-semibold whitespace-nowrap text-zinc-700 transition hover:border-black hover:text-black"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={acceptCookies}
              data-consent={COOKIE_CONSENT_ACCEPTED}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-linear-to-r from-amber-400 to-amber-500 px-4 py-3 text-center text-sm font-semibold whitespace-nowrap text-white transition hover:from-amber-500 hover:to-amber-600"
            >
              Accept Cookies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
