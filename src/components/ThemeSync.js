"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { applyThemePreference, getStoredThemePreference } from "@/lib/theme-client";

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
      }

      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data?.user) {
          applyThemePreference(Boolean(data.user.darkMode), "auth");
          return;
        }
      } catch {
        // Ignore and keep fallback preference.
      }

      if (!cancelled && storedPublic !== null && isPublicPath) {
        applyThemePreference(storedPublic, "public");
      }
    }

    syncFromProfile();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
