"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { applyThemePreference, getStoredThemePreference } from "@/lib/theme-client";

function resolveScope(pathname = "/") {
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/contact-us") ||
    pathname.startsWith("/privacy-policy") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup");
  return isPublic ? "public" : "auth";
}

function readThemeFromDom() {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export const useThemeStore = create(
  persist(
    (set, get) => ({
      themeAuth: null,
      themePublic: null,

      getTheme(scope = "auth") {
        const key = scope === "public" ? "themePublic" : "themeAuth";
        const stored = get()[key];
        if (stored === "dark" || stored === "light") return stored;
        const legacy = getStoredThemePreference(scope);
        if (legacy === true) return "dark";
        if (legacy === false) return "light";
        return readThemeFromDom();
      },

      applyTheme(isDark, scope = "auth") {
        const value = isDark ? "dark" : "light";
        const key = scope === "public" ? "themePublic" : "themeAuth";
        applyThemePreference(isDark, scope);
        set({ [key]: value });
        return value;
      },

      applyThemeForPath(pathname, isDark) {
        return get().applyTheme(isDark, resolveScope(pathname));
      },

      syncFromUser(user, pathname) {
        if (!user || typeof user.darkMode !== "boolean") return;
        get().applyThemeForPath(pathname, Boolean(user.darkMode));
      },
    }),
    {
      name: "owedue-theme-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        themeAuth: state.themeAuth,
        themePublic: state.themePublic,
      }),
    }
  )
);
