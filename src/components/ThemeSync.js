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

/** Applies theme + appearance from store/cookies. Auth fetch runs once in AppStoreBootstrap. */
export default function ThemeSync() {
  const pathname = usePathname();
  const user = useUserStore((s) => s.user);
  const applyThemeForPath = useThemeStore((s) => s.applyThemeForPath);
  const getTheme = useThemeStore((s) => s.getTheme);

  useEffect(() => {
    const publicPath = isPublicPath(pathname);
    const scope = publicPath ? "public" : "auth";
    const stored = getStoredThemePreference(scope);
    const cachedTheme = getTheme(scope);

    if (publicPath && stored !== null) {
      applyThemeForPath(pathname, stored);
      resetAppearancePreference();
      return;
    }

    if (!publicPath && stored !== null) {
      applyThemeForPath(pathname, stored);
    } else if (cachedTheme) {
      applyThemePreference(cachedTheme === "dark", scope);
    }

    if (publicPath) {
      resetAppearancePreference();
    }
  }, [pathname, applyThemeForPath, getTheme]);

  useEffect(() => {
    if (!user || isPublicPath(pathname)) return;

    const isDarkMode = Boolean(user.darkMode);
    applyThemeForPath(pathname, isDarkMode);
    applyAppearancePreference({
      fontPreset: user.fontPreset,
      fontSizePreset: user.fontSizePreset,
      isPremium: Boolean(user.isPremium),
    });
    persistThemePreference({ scope: "auth", isDarkMode });
    persistAppearancePreference({
      fontPreset: user.fontPreset,
      fontSizePreset: user.fontSizePreset,
      isPremium: Boolean(user.isPremium),
    });
  }, [user, pathname, applyThemeForPath]);

  return null;
}
