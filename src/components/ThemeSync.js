"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  applyAppearancePreference,
  applyThemePreference,
  getStoredThemePreference,
  resetAppearancePreference,
} from "@/lib/theme-client";
import {
  persistAppearancePreference,
  persistThemePreference,
} from "@/lib/cookie-preferences";

export default function ThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const isPublicPath =
      pathname === "/" ||
      pathname.startsWith("/contact-us") ||
      pathname.startsWith("/privacy-policy") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup");

    async function syncFromProfile() {
      const storedPublic = getStoredThemePreference("public");

      // Public pages should immediately respect the visitor preference.
      if (storedPublic !== null && isPublicPath) {
        applyThemePreference(storedPublic, "public");
        resetAppearancePreference();
      }

      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data?.user) {
          const isDarkMode = Boolean(data.user.darkMode);
          const isPremium = Boolean(data.user.isPremium);
          const fontPreset = data.user.fontPreset;
          const fontSizePreset = data.user.fontSizePreset;

          applyThemePreference(isDarkMode, "auth");
          applyAppearancePreference({
            fontPreset,
            fontSizePreset,
            isPremium,
          });
          persistThemePreference({ scope: "auth", isDarkMode });
          persistAppearancePreference({ fontPreset, fontSizePreset, isPremium });
          return;
        }
      } catch {
        // Ignore and keep fallback preference.
      }

      if (!cancelled && storedPublic !== null && isPublicPath) {
        applyThemePreference(storedPublic, "public");
        resetAppearancePreference();
        return;
      }

      if (!cancelled) {
        resetAppearancePreference();
      }
    }

    syncFromProfile();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
