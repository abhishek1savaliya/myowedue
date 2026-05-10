"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyThemePreference, getStoredThemePreference } from "@/lib/theme-client";
import { persistThemePreference } from "@/lib/cookie-preferences";

/**
 * @param {{ tone?: "default" | "onDark" }} props
 */
export default function PublicModeToggle({ tone = "default" }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = getStoredThemePreference("public");
    if (stored !== null) {
      setIsDark(stored);
      return;
    }

    const fromAttribute = document.documentElement.getAttribute("data-theme") === "dark";
    setIsDark(fromAttribute);
  }, []);

  const handleToggle = () => {
    const next = !isDark;
    setIsDark(next);
    applyThemePreference(next, "public");
    persistThemePreference({ scope: "public", isDarkMode: next });
  };

  const btnClass =
    tone === "onDark"
      ? "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-600 text-zinc-300 transition hover:border-zinc-500 hover:text-white"
      : "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-300 text-zinc-700 transition hover:border-amber-400 hover:text-amber-600";

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
