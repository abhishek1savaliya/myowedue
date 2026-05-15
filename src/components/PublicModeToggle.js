"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { persistThemePreference } from "@/lib/cookie-preferences";
import { useThemeStore } from "@/stores/useThemeStore";

/**
 * @param {{ tone?: "default" | "onDark" }} props
 */
export default function PublicModeToggle({ tone = "default" }) {
  const pathname = usePathname();
  const applyThemeForPath = useThemeStore((s) => s.applyThemeForPath);
  const getTheme = useThemeStore((s) => s.getTheme);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const scope =
      pathname === "/" ||
      pathname.startsWith("/contact-us") ||
      pathname.startsWith("/privacy-policy") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup")
        ? "public"
        : "auth";
    setIsDark(getTheme(scope) === "dark");
  }, [pathname, getTheme]);

  const handleToggle = () => {
    const next = !isDark;
    setIsDark(next);
    const scope = applyThemeForPath(pathname, next);
    persistThemePreference({ scope, isDarkMode: next });
  };

  const btnClass =
    tone === "onDark"
      ? "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-zinc-300 transition hover:border-white/25 hover:text-white"
      : "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-300 bg-white/80 text-zinc-700 transition hover:border-amber-400 hover:text-amber-600 dark:border-white/15 dark:bg-white/5 dark:text-zinc-300 dark:hover:border-amber-500/40 dark:hover:text-amber-300";

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={btnClass}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
