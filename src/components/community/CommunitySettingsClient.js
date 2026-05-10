"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AtSign,
  BadgeCheck,
  AlertCircle,
  Check,
  ChevronRight,
  LayoutDashboard,
  Loader2,
  Moon,
  PenSquare,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import BackButton from "@/components/BackButton";
import PublicModeToggle from "@/components/PublicModeToggle";
import { useCommunityUsernameCheck } from "@/hooks/useCommunityUsernameCheck";
import {
  COMMUNITY_USERNAME_MAX,
  COMMUNITY_USERNAME_MIN,
  normalizeSavedUsernameHandle,
  tryNormalizeCommunityUsername,
} from "@/lib/community-usernames";
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
  const [communityUsername, setCommunityUsername] = useState("");
  const [usernameDraft, setUsernameDraft] = useState("");
  /** When false and a handle exists, show read-only @handle with edit icon instead of the form. */
  const [usernameEditMode, setUsernameEditMode] = useState(true);
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState("");
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
      const handle = typeof u?.communityUsername === "string" ? u.communityUsername : "";
      setCommunityUsername(handle);
      setUsernameDraft(handle);
      setUsernameEditMode(normalizeSavedUsernameHandle(handle).length === 0);
      setUsernameMessage("");
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

  const savedNorm = normalizeSavedUsernameHandle(communityUsername);
  const hasSavedCommunityUsername = savedNorm.length > 0;
  const usernameCheckEnabled =
    loggedIn && !loading && (!hasSavedCommunityUsername || usernameEditMode);
  const { checking: usernameChecking, result: usernameCheck } = useCommunityUsernameCheck(usernameDraft, {
    enabled: usernameCheckEnabled,
    savedNormalized: savedNorm,
  });

  /** GET /api/auth/me can miss Supabase; when check says this handle is already yours, sync saved state. */
  useEffect(() => {
    if (usernameCheck?.status !== "yours" || typeof usernameCheck.normalized !== "string") return;
    const n = usernameCheck.normalized;
    setCommunityUsername((prev) => (normalizeSavedUsernameHandle(prev) === n ? prev : n));
    setUsernameDraft((prev) => (normalizeSavedUsernameHandle(prev) === n ? prev : n));
  }, [usernameCheck?.status, usernameCheck?.normalized]);

  const usernameParsed = useMemo(() => tryNormalizeCommunityUsername(usernameDraft), [usernameDraft]);
  const usernameUnchanged =
    hasSavedCommunityUsername && usernameParsed.ok && usernameParsed.normalized === savedNorm;

  const saveUsernameHint = (() => {
    if (loading) return "";
    if (!loggedIn) return "";
    if (!usernameParsed.ok && String(usernameDraft || "").trim()) return usernameParsed.error || "Fix the username above.";
    if (usernameParsed.ok && usernameUnchanged) return "Change the handle to something new to enable Save.";
    return "";
  })();

  const saveCommunityUsername = useCallback(
    async (e) => {
      e.preventDefault();
      if (!loggedIn || savingUsername) return;
      const parsed = tryNormalizeCommunityUsername(usernameDraft);
      if (!parsed.ok) {
        setUsernameMessage(parsed.error);
        return;
      }
      const currentSaved = normalizeSavedUsernameHandle(communityUsername);
      if (currentSaved.length > 0 && parsed.normalized === currentSaved) {
        setUsernameMessage("No changes to save.");
        return;
      }
      setSavingUsername(true);
      setUsernameMessage("");
      setError("");
      try {
        const res = await fetch("/api/community/username", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username: parsed.normalized }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Failed to save");
        if (typeof data.username === "string") {
          setCommunityUsername(data.username);
          setUsernameDraft(data.username);
        }
        setUsernameEditMode(false);
        setUsernameMessage("Username saved.");
        dispatchCommunityMutate();
      } catch (err) {
        setUsernameMessage(err.message || "Failed to save");
      } finally {
        setSavingUsername(false);
      }
    },
    [loggedIn, savingUsername, usernameDraft, communityUsername]
  );

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

        <section
          className={`${card} ${loggedIn && !hasSavedCommunityUsername ? "ring-2 ring-amber-300/80 dark:ring-amber-600/50" : ""}`}
          aria-labelledby="community-username"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 dark:bg-slate-800">
              <AtSign className="h-5 w-5 text-zinc-600 dark:text-zinc-300" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="community-username" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Community @username
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                Unique handle next to your name on posts and replies. {COMMUNITY_USERNAME_MIN}–{COMMUNITY_USERNAME_MAX} characters: lowercase letters, numbers, underscores.
                Availability is checked as you type.
              </p>
              {loggedIn && !hasSavedCommunityUsername ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Set a username to show your @handle on community posts.
                </p>
              ) : null}
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
                  to set your handle.
                </p>
              ) : hasSavedCommunityUsername && !usernameEditMode ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-stretch gap-2 sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 dark:border-zinc-600 dark:bg-slate-950">
                      <span className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">@</span>
                      <p className="min-w-0 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{savedNorm}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUsernameDraft(communityUsername);
                        setUsernameMessage("");
                        setUsernameEditMode(true);
                      }}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-zinc-700 shadow-sm transition hover:bg-stone-50 dark:border-zinc-600 dark:bg-slate-900 dark:text-zinc-200 dark:hover:bg-slate-800"
                      aria-label="Edit username"
                    >
                      <PenSquare className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Saved handle shown above. Use the edit button to change it.
                  </p>
                  {usernameMessage ? (
                    <p className={`text-xs ${usernameMessage.includes("saved") ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-300"}`}>
                      {usernameMessage}
                    </p>
                  ) : null}
                </div>
              ) : (
                <form onSubmit={saveCommunityUsername} className="mt-4 space-y-3">
                  <div
                    className={`flex rounded-xl border bg-white dark:bg-slate-950 ${
                      usernameChecking
                        ? "border-zinc-300 dark:border-zinc-600"
                        : usernameCheck?.available === true
                          ? "border-emerald-500/90 dark:border-emerald-500/70"
                          : usernameCheck && usernameCheck.available === false
                            ? "border-rose-500/90 dark:border-rose-500/70"
                            : "border-stone-200 dark:border-zinc-600"
                    }`}
                  >
                    <span className="flex items-center border-r border-stone-200 px-3 text-sm text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
                      @
                    </span>
                    <input
                      value={usernameDraft}
                      onChange={(e) => setUsernameDraft(e.target.value)}
                      placeholder="your_handle"
                      autoComplete="username"
                      maxLength={COMMUNITY_USERNAME_MAX}
                      className="min-w-0 flex-1 rounded-r-xl bg-transparent px-3 py-2 text-sm text-zinc-900 outline-none dark:text-zinc-100"
                      aria-label="Community username"
                      aria-invalid={usernameCheck?.available === false}
                    />
                  </div>

                  <div className="flex min-h-5 flex-wrap items-center gap-2 text-xs">
                    {usernameChecking ? (
                      <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        Checking availability…
                      </span>
                    ) : usernameCheck?.status === "short" ? (
                      <span className="text-amber-800 dark:text-amber-300">
                        Type at least {COMMUNITY_USERNAME_MIN} characters ({usernameCheck.needed ?? COMMUNITY_USERNAME_MIN} more).
                      </span>
                    ) : usernameCheck?.status === "long" ? (
                      <span className="text-rose-700 dark:text-rose-300">Maximum {COMMUNITY_USERNAME_MAX} characters.</span>
                    ) : usernameCheck?.status === "invalid_chars" ? (
                      <span className="text-rose-700 dark:text-rose-300">Only a–z, 0–9, and underscore.</span>
                    ) : usernameCheck?.status === "reserved" ? (
                      <span className="text-rose-700 dark:text-rose-300">That username is reserved.</span>
                    ) : usernameCheck?.status === "taken" ? (
                      <span className="flex items-center gap-1 text-rose-700 dark:text-rose-300">
                        <X className="h-3.5 w-3.5" aria-hidden />
                        Already taken.
                      </span>
                    ) : usernameCheck?.status === "available" ? (
                      <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        Available.
                      </span>
                    ) : usernameCheck?.status === "yours" ? (
                      <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        This is your current username.
                      </span>
                    ) : usernameCheck?.configured === false ? (
                      <span className="text-zinc-500">Community database not configured.</span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingUsername || !loggedIn || loading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      {savingUsername ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                      {savingUsername ? "Saving…" : "Save username"}
                    </button>
                    {hasSavedCommunityUsername ? (
                      <button
                        type="button"
                        onClick={() => {
                          setUsernameDraft(communityUsername);
                          setUsernameMessage("");
                          setUsernameEditMode(false);
                        }}
                        className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-stone-50 dark:border-zinc-600 dark:bg-slate-900 dark:text-zinc-300 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                  {saveUsernameHint ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400" role="status">
                      {saveUsernameHint}
                    </p>
                  ) : null}
                  {usernameMessage ? (
                    <p className={`text-xs ${usernameMessage.includes("saved") ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-300"}`}>
                      {usernameMessage}
                    </p>
                  ) : null}
                </form>
              )}
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
