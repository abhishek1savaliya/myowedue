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
import { useUserStore } from "@/stores/useUserStore";

export default function ThemeSync() {
  const pathname = usePathname();
  const user = useUserStore((s) => s.user);
  const fetchUser = useUserStore((s) => s.fetchUser);

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

      if (storedPublic !== null && isPublicPath) {
        applyThemePreference(storedPublic, "public");
        resetAppearancePreference();
      }

      try {
        const profileUser = user ?? (await fetchUser());
        if (!cancelled && profileUser) {
          const isDarkMode = Boolean(profileUser.darkMode);
          const isPremium = Boolean(profileUser.isPremium);
          const fontPreset = profileUser.fontPreset;
          const fontSizePreset = profileUser.fontSizePreset;

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

    void syncFromProfile();

    return () => {
      cancelled = true;
    };
  }, [pathname, user, fetchUser]);

  return null;
}
