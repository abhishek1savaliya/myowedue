"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import BackButton from "@/components/BackButton";
import { applyAppearancePreference, applyThemePreference } from "@/lib/theme-client";
import {
  persistAppearancePreference,
  persistThemePreference,
} from "@/lib/cookie-preferences";
import { useUserStore } from "@/stores/useUserStore";

const cardShadow =
  "shadow-[0_2px_8px_rgba(0,0,0,0.04),0_24px_48px_-12px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2),0_24px_48px_-12px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)]";

const inputClass =
  "w-full rounded-2xl border border-zinc-200/90 bg-zinc-50/80 px-4 py-3.5 text-[15px] text-zinc-900 outline-none transition duration-200 placeholder:text-zinc-400 hover:border-zinc-300/90 hover:bg-white/90 focus:border-amber-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(251,191,36,0.2)] focus:ring-0 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:hover:border-zinc-600 dark:focus:border-amber-500 dark:focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)] sm:py-4 sm:text-base";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", rememberMe: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.message || "Login failed");
      return;
    }

    if (data?.user) {
      useUserStore.getState().setUser(data.user);
    }

    if (data?.user && typeof data.user.darkMode === "boolean") {
      const isDarkMode = Boolean(data.user.darkMode);
      const isPremium = Boolean(data.user.isPremium);
      const fontPreset = data.user.fontPreset;
      const fontSizePreset = data.user.fontSizePreset;

      applyThemePreference(isDarkMode);
      applyAppearancePreference({
        fontPreset,
        fontSizePreset,
        isPremium,
      });
      persistThemePreference({ scope: "auth", isDarkMode });
      persistAppearancePreference({ fontPreset, fontSizePreset, isPremium });
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 p-6 backdrop-blur-sm sm:rounded-3xl sm:p-8 md:p-10 dark:border-zinc-700/80 dark:bg-zinc-900/90 ${cardShadow}`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-200/60 to-transparent dark:via-amber-500/20"
        aria-hidden
      />

      <div className="mb-5">
        <BackButton href="/" label="Back to home" />
      </div>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-amber-400 via-amber-500 to-amber-600 shadow-lg shadow-amber-500/30 ring-1 ring-amber-400/40 dark:shadow-amber-900/40 dark:ring-amber-500/30 sm:h-14 sm:w-14">
          <LogIn className="h-6 w-6 text-white sm:h-7 sm:w-7" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1
            className="font-(family-name:--font-display) text-[1.65rem] font-semibold leading-tight tracking-[0.12em] text-zinc-900 sm:text-3xl md:text-[2rem] md:tracking-[0.14em] dark:text-zinc-50"
            style={{ fontFeatureSettings: '"kern" 1, "liga" 1' }}
          >
            Welcome Back
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-zinc-600 sm:text-[0.9375rem] dark:text-zinc-400">
            Log in to manage credit, debit and dues.
          </p>
        </div>
      </header>

      <form onSubmit={onSubmit} className="mt-8 space-y-5 sm:mt-10 sm:space-y-6">
        <div className="space-y-2">
          <label
            htmlFor="login-email"
            className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-500"
          >
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="your@email.com"
            value={form.email}
            onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
            className={inputClass}
            required
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="login-password"
            className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-500"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
            className={inputClass}
            required
          />
        </div>

        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl py-1 sm:gap-3.5">
          <input
            type="checkbox"
            checked={form.rememberMe}
            onChange={(e) => setForm((v) => ({ ...v, rememberMe: e.target.checked }))}
            className="h-4.5 w-4.5 shrink-0 rounded border-zinc-300 text-amber-600 accent-amber-500 focus:ring-2 focus:ring-amber-400/50 focus:ring-offset-2 focus:ring-offset-white dark:border-zinc-600 dark:focus:ring-amber-500/40 dark:focus:ring-offset-zinc-900"
          />
          <span className="text-sm leading-snug text-zinc-600 dark:text-zinc-400">
            Keep me logged in for 7 days
          </span>
        </label>

        {error ? (
          <div
            className="rounded-2xl border border-red-200/90 bg-red-50/95 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="group relative mt-2 w-full overflow-hidden rounded-2xl bg-linear-to-r from-amber-500 via-amber-500 to-amber-600 px-4 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-amber-500/25 transition duration-200 hover:from-amber-500 hover:via-amber-600 hover:to-amber-600 hover:shadow-xl hover:shadow-amber-500/30 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100 sm:py-4 sm:text-base dark:shadow-amber-900/30 dark:hover:shadow-amber-900/40"
        >
          <span className="relative z-1">{loading ? "Signing in…" : "Sign in"}</span>
          <span
            className="absolute inset-0 bg-linear-to-t from-white/0 via-white/10 to-white/0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            aria-hidden
          />
        </button>
      </form>

      <p className="mt-8 border-t border-zinc-100 pt-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 sm:mt-10">
        New here?{" "}
        <Link
          href="/signup"
          className="font-semibold text-amber-600 underline decoration-amber-600/30 underline-offset-2 transition hover:text-amber-700 hover:decoration-amber-700 dark:text-amber-400 dark:decoration-amber-400/30 dark:hover:text-amber-300"
        >
          Create account
        </Link>
      </p>
    </section>
  );
}
