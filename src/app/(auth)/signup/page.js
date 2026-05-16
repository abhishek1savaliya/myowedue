"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, UserPlus, X } from "lucide-react";
import BackButton from "@/components/BackButton";
import PublicModeToggle from "@/components/PublicModeToggle";
import { applyAppearancePreference, applyThemePreference } from "@/lib/theme-client";
import {
  persistAppearancePreference,
  persistThemePreference,
} from "@/lib/cookie-preferences";
import { useUserStore } from "@/stores/useUserStore";
import { usePublicCommunityUsernameCheck } from "@/hooks/usePublicCommunityUsernameCheck";
import {
  COMMUNITY_USERNAME_MAX,
  COMMUNITY_USERNAME_MIN,
  tryNormalizeCommunityUsername,
} from "@/lib/community-usernames";

const cardShadow =
  "shadow-[0_2px_8px_rgba(0,0,0,0.04),0_24px_48px_-12px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2),0_24px_48px_-12px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)]";

const inputClass =
  "w-full rounded-2xl border border-zinc-200/90 bg-zinc-50/80 px-4 py-3.5 text-[15px] text-zinc-900 outline-none transition duration-200 placeholder:text-zinc-400 hover:border-zinc-300/90 hover:bg-white/90 focus:border-amber-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(251,191,36,0.2)] focus:ring-0 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:hover:border-zinc-600 dark:focus:border-amber-500 dark:focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)] sm:py-4 sm:text-base";

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-500";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    communityUsername: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const usernameCheckEnabled = true;
  const { checking: usernameChecking, result: usernameCheck } = usePublicCommunityUsernameCheck(
    form.communityUsername,
    { enabled: usernameCheckEnabled }
  );

  const usernameParsed = useMemo(
    () => tryNormalizeCommunityUsername(form.communityUsername),
    [form.communityUsername]
  );

  const usernameReadyForSubmit =
    usernameCheck?.configured === true &&
    usernameCheck?.status === "available" &&
    usernameParsed.ok;

  const canSubmit =
    !loading &&
    usernameCheck?.configured !== false &&
    usernameReadyForSubmit;

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        communityUsername: usernameParsed.ok ? usernameParsed.normalized : form.communityUsername,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.message || "Signup failed");
      return;
    }

    if (data?.user) {
      useUserStore.getState().setUser(data.user);

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

  const usernameShell = (() => {
    const okBorder = usernameCheck?.available === true;
    const badBorder = usernameCheck && usernameCheck.available === false;
    return `flex rounded-2xl border bg-zinc-50/80 transition duration-200 dark:bg-zinc-950/50 ${
      usernameChecking
        ? "border-zinc-200/90 dark:border-zinc-700"
        : okBorder
          ? "border-emerald-400/90 shadow-[0_0_0_3px_rgba(16,185,129,0.12)] dark:border-emerald-500/70"
          : badBorder
            ? "border-rose-400/90 dark:border-rose-500/70"
            : "border-zinc-200/90 hover:border-zinc-300/90 dark:border-zinc-700 dark:hover:border-zinc-600"
    } focus-within:border-amber-400 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(251,191,36,0.2)] dark:focus-within:border-amber-500 dark:focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.15)]`;
  })();

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 p-6 backdrop-blur-sm sm:rounded-3xl sm:p-8 md:p-10 dark:border-zinc-700/80 dark:bg-zinc-900/90 ${cardShadow}`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-200/60 to-transparent dark:via-amber-500/20"
        aria-hidden
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <BackButton href="/" label="Back to home" />
        <PublicModeToggle />
      </div>

      <header className="mb-6 border-b border-zinc-200/80 pb-5 dark:border-zinc-700/80">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 sm:gap-3"
        >
          <Image
            src="/owedue-logo.svg"
            alt="OWE DUE logo"
            width={40}
            height={40}
            className="h-9 w-9 shrink-0 rounded-lg sm:h-10 sm:w-10"
          />
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-xl">OWE DUE</p>
            <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400 sm:text-xs">Personal credit & debit tracker</p>
          </div>
        </Link>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-amber-400 via-amber-500 to-amber-600 shadow-lg shadow-amber-500/30 ring-1 ring-amber-400/40 dark:shadow-amber-900/40 dark:ring-amber-500/30 sm:h-14 sm:w-14">
          <UserPlus className="h-6 w-6 text-white sm:h-7 sm:w-7" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-200">
            New account
          </p>
          <h1
            className="font-(family-name:--font-display) mt-3 text-[1.65rem] font-semibold leading-tight tracking-tight text-zinc-900 sm:text-3xl md:text-[2rem] dark:text-zinc-50"
            style={{ fontFeatureSettings: '"kern" 1, "liga" 1' }}
          >
            Create your account
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-zinc-600 sm:text-[0.9375rem] dark:text-zinc-400">
            Start tracking who owes and what you owe.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-5 sm:mt-10 sm:space-y-6">
        <div className="space-y-2">
          <label className={labelClass} htmlFor="signup-username">
            Username <span className="text-amber-600 dark:text-amber-400">*</span>
          </label>
          <div className={usernameShell}>
            <span className="flex items-center border-r border-zinc-200/90 px-3.5 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              @
            </span>
            <input
              id="signup-username"
              type="text"
              placeholder="e.g. jane_doe99"
              value={form.communityUsername}
              onChange={(e) => setForm((v) => ({ ...v, communityUsername: e.target.value }))}
              autoComplete="username"
              maxLength={COMMUNITY_USERNAME_MAX}
              className="min-w-0 flex-1 rounded-r-2xl bg-transparent px-4 py-3.5 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 sm:py-4 sm:text-base dark:text-zinc-100 dark:placeholder:text-zinc-500"
              required
              aria-invalid={usernameCheck?.available === false}
              aria-describedby="signup-username-hint"
            />
          </div>
          <div id="signup-username-hint" className="min-h-5 text-xs text-zinc-600 dark:text-zinc-400">
            {usernameCheck?.configured === false ? (
              <span className="text-rose-700 dark:text-rose-300">Registration is unavailable: community database is not configured.</span>
            ) : usernameChecking ? (
              <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Checking availability…
              </span>
            ) : usernameCheck?.status === "short" ? (
              <span className="text-amber-800 dark:text-amber-200">
                At least {COMMUNITY_USERNAME_MIN} characters ({usernameCheck.needed ?? ""} more).
              </span>
            ) : usernameCheck?.status === "long" ? (
              <span className="text-rose-700 dark:text-rose-300">Max {COMMUNITY_USERNAME_MAX} characters.</span>
            ) : usernameCheck?.status === "invalid_chars" ? (
              <span className="text-rose-700 dark:text-rose-300">Only a–z, 0–9, and underscore.</span>
            ) : usernameCheck?.status === "reserved" ? (
              <span className="text-rose-700 dark:text-rose-300">That username is reserved.</span>
            ) : usernameCheck?.status === "taken" ? (
              <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300">
                <X className="h-3.5 w-3.5" aria-hidden />
                Already taken — choose another.
              </span>
            ) : usernameCheck?.status === "available" ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Available — you can create your account.
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="signup-first">
              First name
            </label>
            <input
              id="signup-first"
              type="text"
              placeholder="John"
              value={form.firstName}
              onChange={(e) => setForm((v) => ({ ...v, firstName: e.target.value }))}
              className={inputClass}
              required
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="signup-last">
              Last name
            </label>
            <input
              id="signup-last"
              type="text"
              placeholder="Doe"
              value={form.lastName}
              onChange={(e) => setForm((v) => ({ ...v, lastName: e.target.value }))}
              className={inputClass}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            placeholder="your@email.com"
            value={form.email}
            onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
            className={inputClass}
            required
          />
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="signup-phone">
            Phone <span className="font-normal normal-case tracking-normal text-zinc-400">(optional)</span>
          </label>
          <input
            id="signup-phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={form.phone}
            onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))}
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="signup-password">
            Password <span className="font-normal normal-case tracking-normal text-zinc-400">(min 6)</span>
          </label>
          <input
            id="signup-password"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
            className={inputClass}
            required
          />
        </div>

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
          disabled={!canSubmit || loading}
          className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 py-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white sm:py-4 sm:text-base"
        >
          {loading ? "Creating account…" : "Create your account"}
          {!loading ? <ArrowRight className="h-4 w-4 opacity-90 transition group-hover:translate-x-0.5" aria-hidden /> : null}
        </button>
      </form>

      <p className="mt-8 border-t border-zinc-100 pt-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 sm:mt-10">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-amber-600 underline decoration-amber-600/30 underline-offset-2 transition hover:text-amber-700 hover:decoration-amber-700 dark:text-amber-400 dark:decoration-amber-400/30 dark:hover:text-amber-300"
        >
          Sign in
        </Link>
      </p>
    </section>
  );
}
