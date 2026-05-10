"use client";

import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 320;

/**
 * Debounced GET /api/auth/community-username-check (no auth) for sign-up.
 * @param {string} draft
 * @param {{ enabled: boolean }} opts
 */
export function usePublicCommunityUsernameCheck(draft, { enabled }) {
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

    const timer = window.setTimeout(async () => {
      const id = ++latestIdRef.current;
      setChecking(true);
      try {
        const res = await fetch(`/api/auth/community-username-check?q=${encodeURIComponent(q)}`, {
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
  }, [draft, enabled]);

  return { checking, result };
}
