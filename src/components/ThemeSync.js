"use client";

import { useEffect } from "react";
import { applyThemePreference, getStoredThemePreference } from "@/lib/theme-client";

export default function ThemeSync() {
  useEffect(() => {
    const stored = getStoredThemePreference();
    if (stored !== null) {
      applyThemePreference(stored);
    }

    let cancelled = false;

    async function syncFromProfile() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data?.user) {
          applyThemePreference(Boolean(data.user.darkMode));
        }
      } catch {
        // Keep stored preference if profile sync fails.
      }
    }

    syncFromProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
