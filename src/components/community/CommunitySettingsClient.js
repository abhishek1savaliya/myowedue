"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  ChevronRight,
  LayoutDashboard,
  Loader2,
  Moon,
  PenSquare,
  Settings2,
  Sparkles,
} from "lucide-react";
import BackButton from "@/components/BackButton";
import PublicModeToggle from "@/components/PublicModeToggle";
import { dispatchCommunityMutate } from "@/lib/community-mutate-event";

const card =
  "rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-sm dark:border-zinc-700 dark:bg-slate-900/80 sm:p-5";

const linkRow =
  "flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-stone-50 dark:border-zinc-700 dark:bg-slate-900/80 dark:text-zinc-100 dark:hover:bg-slate-800/80";

export default function CommunitySettingsClient() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState(null);
  const [savingBadge, setSavingBadge] = useState(false);
  const [error, setError] = useState("");

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoggedIn(false);
        setViewer(null);
        return;
      }
      setLoggedIn(true);
      const u = data.user;
      setViewer({
        isPremium: Boolean(u?.isPremium),
        showVerifiedBadge: Boolean(u?.showVerifiedBadge),
      });
    } catch {
      setError("Could not load account.");
      setLoggedIn(false);
      setViewer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  const updateVerifiedBadge = useCallback(
    async (next) => {
      if (!viewer?.isPremium || savingBadge) return;
      setSavingBadge(true);
      setError("");
      try {
        const res = await fetch("/api/auth/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ showVerifiedBadge: next }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Failed to save");
        setViewer({
          isPremium: Boolean(data.user?.isPremium),
          showVerifiedBadge: Boolean(data.user?.showVerifiedBadge),
        });
        dispatchCommunityMutate();
      } catch (e) {
        setError(e.message || "Failed to save");
      } finally {
        setSavingBadge(false);
      }
    },
    [viewer?.isPremium, savingBadge]
  );

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col px-3 py-4 text-[15px] md:px-4 md:py-6">
      <div className="mb-6 flex items-center gap-3">
        <BackButton href="/community" />
        <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Settings</h1>
      </div>

      <p className="mb-6 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Community appearance, your verified badge, and shortcuts to the full app.
      </p>

      <div className="space-y-4">
        <section className={card} aria-labelledby="community-appearance">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 dark:bg-slate-800">
              <Moon className="h-5 w-5 text-zinc-600 dark:text-zinc-300" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="community-appearance" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Appearance
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                Light or dark mode for this public community view (saved in this browser).
              </p>
              <div className="mt-3 flex items-center gap-3">
                <PublicModeToggle />
                <span className="text-xs text-zinc-500 dark:text-zinc-500">Toggle theme</span>
              </div>
            </div>
          </div>
        </section>

        <section className={card} aria-labelledby="community-verified">
          <div className="flex items-start gap-3">
            <BadgeCheck className="mt-0.5 h-6 w-6 shrink-0 text-sky-500" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 id="community-verified" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Verified badge
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                Show a blue check next to your name on posts so others know your account is verified.
              </p>
              {loading ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading…
                </p>
              ) : !loggedIn ? (
                <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                  <Link href="/login?next=/community/settings" className="font-semibold text-amber-700 underline dark:text-amber-400">
                    Sign in
                  </Link>{" "}
                  to manage this option.
                </p>
              ) : viewer?.isPremium ? (
                <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 text-sky-600 focus:ring-sky-500 dark:border-zinc-600 dark:bg-slate-900"
                    checked={Boolean(viewer.showVerifiedBadge)}
                    disabled={savingBadge}
                    onChange={(e) => void updateVerifiedBadge(e.target.checked)}
                  />
                  <span>Show verified badge publicly</span>
                </label>
              ) : (
                <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                  Available with an active premium subscription.{" "}
                  <Link href="/my-subscription" className="font-semibold text-amber-700 underline dark:text-amber-400">
                    View subscription
                  </Link>
                </p>
              )}
            </div>
          </div>
        </section>

        <section className={card} aria-labelledby="community-account">
          <div className="mb-3 flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
            <h2 id="community-account" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Account & app
            </h2>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            Open your workspace, posts, billing, or full settings.
          </p>
          <ul className="space-y-2">
            <li>
              <Link href={loggedIn ? "/dashboard" : "/login?next=/dashboard"} className={linkRow}>
                <span className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                  Dashboard
                </span>
                <ChevronRight className="h-4 w-4 text-zinc-400" aria-hidden />
              </Link>
            </li>
            <li>
              <Link href={loggedIn ? "/posts" : "/login?next=/posts"} className={linkRow}>
                <span className="flex items-center gap-2">
                  <PenSquare className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                  My posts
                </span>
                <ChevronRight className="h-4 w-4 text-zinc-400" aria-hidden />
              </Link>
            </li>
            <li>
              <Link href={loggedIn ? "/my-subscription" : "/login?next=/my-subscription"} className={linkRow}>
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                  Subscription
                </span>
                <ChevronRight className="h-4 w-4 text-zinc-400" aria-hidden />
              </Link>
            </li>
            <li>
              <Link href={loggedIn ? "/settings" : "/login?next=/settings"} className={linkRow}>
                <span className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden />
                  App settings
                </span>
                <ChevronRight className="h-4 w-4 text-zinc-400" aria-hidden />
              </Link>
            </li>
          </ul>
        </section>

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
