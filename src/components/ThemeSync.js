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
import { useThemeStore } from "@/stores/useThemeStore";

function isPublicPath(pathname) {
  return (
    pathname === "/" ||
    pathname.startsWith("/contact-us") ||
    pathname.startsWith("/privacy-policy") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup")
  );
}

export default function ThemeSync() {
  const pathname = usePathname();
  const user = useUserStore((s) => s.user);
  const fetchUser = useUserStore((s) => s.fetchUser);
  const applyThemeForPath = useThemeStore((s) => s.applyThemeForPath);
  const getTheme = useThemeStore((s) => s.getTheme);

  useEffect(() => {
    let cancelled = false;
    const publicPath = isPublicPath(pathname);
    const scope = publicPath ? "public" : "auth";

    async function syncFromProfile() {
      const storedPublic = getStoredThemePreference("public");
      const storedAuth = getStoredThemePreference("auth");
      const cachedTheme = getTheme(scope);

      if (publicPath && storedPublic !== null) {
        applyThemeForPath(pathname, storedPublic);
        resetAppearancePreference();
        return;
      }

      if (!publicPath && storedAuth !== null) {
        applyThemeForPath(pathname, storedAuth);
      } else if (cachedTheme) {
        applyThemePreference(cachedTheme === "dark", scope);
      }

      try {
        const profileUser = user ?? (await fetchUser({ force: false }));
        if (cancelled) return;

        if (profileUser && !publicPath) {
          const isDarkMode = Boolean(profileUser.darkMode);
          const isPremium = Boolean(profileUser.isPremium);
          const fontPreset = profileUser.fontPreset;
          const fontSizePreset = profileUser.fontSizePreset;

          applyThemeForPath(pathname, isDarkMode);
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
        /* keep stored theme */
      }

      if (!cancelled && publicPath && storedPublic !== null) {
        applyThemeForPath(pathname, storedPublic);
        resetAppearancePreference();
        return;
      }

      if (!cancelled && publicPath) {
        resetAppearancePreference();
      }
    }

    void syncFromProfile();

    return () => {
      cancelled = true;
    };
  }, [pathname, user, fetchUser, applyThemeForPath, getTheme]);

  return null;
}
