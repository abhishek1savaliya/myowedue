"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { persistThemePreference } from "@/lib/cookie-preferences";
import { useThemeStore } from "@/stores/useThemeStore";

function readIsDark() {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function isPublicPath(pathname) {
  return (
    pathname === "/" ||
    pathname.startsWith("/contact-us") ||
    pathname.startsWith("/privacy-policy") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup")
  );
}

/**
 * @param {{ tone?: "default" | "onDark" }} props
 */
export default function PublicModeToggle({ tone = "default" }) {
  const pathname = usePathname();
  const applyThemeForPath = useThemeStore((s) => s.applyThemeForPath);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(readIsDark());
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(readIsDark()));
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const handleToggle = () => {
    const next = !readIsDark();
    setIsDark(next);
    const scope = isPublicPath(pathname) ? "public" : "auth";
    applyThemeForPath(pathname, next);
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
