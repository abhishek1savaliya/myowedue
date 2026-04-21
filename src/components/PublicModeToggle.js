"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyThemePreference, getStoredThemePreference } from "@/lib/theme-client";

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
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700 transition hover:border-amber-400 hover:text-amber-600"
    >
      {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      {isDark ? "Light" : "Dark"}
    </button>
  );
}