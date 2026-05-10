"use client";

import { useEffect, useRef, useState } from "react";
import {
  COMMUNITY_USERNAME_MAX,
  COMMUNITY_USERNAME_MIN,
  normalizeSavedUsernameHandle,
} from "@/lib/community-usernames";

const DEBOUNCE_MS = 320;

/**
 * Debounced GET /api/community/username/check for the current draft value.
 * When the draft matches the already-saved handle (normalized), skips the network and
 * returns a local "yours" result — no database round-trip.
 *
 * @param {string} draft Raw input (may be incomplete while typing).
 * @param {{ enabled: boolean; savedNormalized?: string }} opts
 */
export function useCommunityUsernameCheck(draft, { enabled, savedNormalized = "" }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const latestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setResult(null);
      setChecking(false);
      return undefined;
    }

    const q = String(draft ?? "").trim();
    if (q.length === 0) {
      setResult(null);
      setChecking(false);
      return undefined;
    }

    const draftNorm = normalizeSavedUsernameHandle(draft);
    const savedNorm = normalizeSavedUsernameHandle(savedNormalized);
    if (savedNorm.length > 0 && draftNorm === savedNorm) {
      setChecking(false);
      setResult({
        configured: true,
        status: "yours",
        available: true,
        normalized: savedNorm,
        min: COMMUNITY_USERNAME_MIN,
        max: COMMUNITY_USERNAME_MAX,
      });
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      const id = ++latestIdRef.current;
      setChecking(true);
      try {
        const res = await fetch(`/api/community/username/check?q=${encodeURIComponent(q)}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (id !== latestIdRef.current) return;
        setResult(res.ok ? data : null);
      } catch {
        if (id !== latestIdRef.current) return;
        setResult(null);
      } finally {
        if (id === latestIdRef.current) setChecking(false);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [draft, enabled, savedNormalized]);

  return { checking, result };
}
