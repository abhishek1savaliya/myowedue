"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyThemePreference, getStoredThemePreference } from "@/lib/theme-client";
import { persistThemePreference } from "@/lib/cookie-preferences";

export default function PublicModeToggle() {
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

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-300 text-zinc-700 transition hover:border-amber-400 hover:text-amber-600"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
