"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Lock, Loader2, Moon, PenSquare, Sun, X } from "lucide-react";
import Loader from "@/components/Loader";
import { useCommunityUsernameCheck } from "@/hooks/useCommunityUsernameCheck";
import {
  COMMUNITY_USERNAME_MAX,
  COMMUNITY_USERNAME_MIN,
  normalizeSavedUsernameHandle,
  tryNormalizeCommunityUsername,
} from "@/lib/community-usernames";
import { FONT_PRESETS, FONT_SIZE_PRESETS } from "@/lib/appearance";
import { applyAppearancePreference, applyThemePreference } from "@/lib/theme-client";
import {
  persistAppearancePreference,
  persistThemePreference,
} from "@/lib/cookie-preferences";

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    joinDate: "",
  });
  const [frequency, setFrequency] = useState("weekly");
  const [darkMode, setDarkMode] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [fontPreset, setFontPreset] = useState("manrope");
  const [fontSizePreset, setFontSizePreset] = useState("size-4");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileMessage, setProfileMessage] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [concurrentSessionLimit, setConcurrentSessionLimit] = useState(1);
  const [recentLogins, setRecentLogins] = useState([]);
  const [loadingLoginActivity, setLoadingLoginActivity] = useState(true);
  const [loginActivityMessage, setLoginActivityMessage] = useState("");
  const [communityUsername, setCommunityUsername] = useState("");
  const [savedCommunityUsername, setSavedCommunityUsername] = useState("");
  const [usernameMessage, setUsernameMessage] = useState("");
  /** When false and a handle exists, show read-only @handle with edit control. */
  const [communityUsernameEditMode, setCommunityUsernameEditMode] = useState(true);
  /** Only true after a successful /api/auth/me — avoids blocking Save when profile state is still initial empty. */
  const [profileLoadedOk, setProfileLoadedOk] = useState(false);

  async function loadProfile() {
    setLoadingProfile(true);
    setProfileLoadedOk(false);
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.user) {
      const user = data.user;
      setProfile({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
        joinDate: user.joinDate || "",
      });
      setFrequency(user.reminderFrequency || "weekly");
      const userDarkMode = Boolean(user.darkMode);
      const premium = Boolean(user.isPremium);
      const nextFontPreset = user.fontPreset || "manrope";
      const nextFontSizePreset = user.fontSizePreset || "size-4";
      setDarkMode(userDarkMode);
      applyThemePreference(userDarkMode);
      setIsPremium(premium);
      setFontPreset(nextFontPreset);
      setFontSizePreset(nextFontSizePreset);
      applyAppearancePreference({
        fontPreset: nextFontPreset,
        fontSizePreset: nextFontSizePreset,
        isPremium: premium,
      });
      persistThemePreference({ scope: "auth", isDarkMode: userDarkMode });
      persistAppearancePreference({
        fontPreset: nextFontPreset,
        fontSizePreset: nextFontSizePreset,
        isPremium: premium,
      });
      setNotificationsEnabled(user.notificationsEnabled !== false);
      const handle = typeof user.communityUsername === "string" ? user.communityUsername : "";
      setCommunityUsername(handle);
      setSavedCommunityUsername(handle);
      setCommunityUsernameEditMode(normalizeSavedUsernameHandle(handle).length === 0);
      setUsernameMessage("");
      setProfileLoadedOk(true);
    }

    setLoadingProfile(false);
  }

  async function loadLoginActivity() {
    setLoadingLoginActivity(true);
    const res = await fetch("/api/auth/login-activity", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setConcurrentSessionLimit(Math.min(5, Math.max(1, Number(data.concurrentSessionLimit || 1))));
      setRecentLogins(Array.isArray(data.recentLogins) ? data.recentLogins : []);
    } else {
      setLoginActivityMessage(data.message || "Failed to load login activity");
    }
    setLoadingLoginActivity(false);
  }

  useEffect(() => {
    loadProfile();
    loadLoginActivity();
  }, []);

  const savedNorm = normalizeSavedUsernameHandle(savedCommunityUsername);
  const hasSavedCommunityUsername = savedNorm.length > 0;
  const usernameCheckEnabled =
    !loadingProfile && profileLoadedOk && (!hasSavedCommunityUsername || communityUsernameEditMode);
  const { checking: usernameChecking, result: usernameCheck } = useCommunityUsernameCheck(communityUsername, {
    enabled: usernameCheckEnabled,
    savedNormalized: savedNorm,
  });

  /** If /api/auth/me omitted Supabase handle but check confirms this name is already yours, sync saved state. */
  useEffect(() => {
    if (usernameCheck?.status !== "yours" || typeof usernameCheck.normalized !== "string") return;
    const n = usernameCheck.normalized;
    setSavedCommunityUsername((prev) => (normalizeSavedUsernameHandle(prev) === n ? prev : n));
    setCommunityUsername((prev) => (normalizeSavedUsernameHandle(prev) === n ? prev : n));
  }, [usernameCheck?.status, usernameCheck?.normalized]);

  const usernameParsed = useMemo(() => tryNormalizeCommunityUsername(communityUsername), [communityUsername]);
  const usernameUnchanged =
    hasSavedCommunityUsername && usernameParsed.ok && usernameParsed.normalized === savedNorm;

  const saveUsernameHint = (() => {
    if (loadingProfile) return "";
    if (!profileLoadedOk) return "Sign in and refresh this page to save your community username.";
    if (!usernameParsed.ok && String(communityUsername || "").trim()) return usernameParsed.error || "Fix the username above.";
    if (usernameParsed.ok && usernameUnchanged) return "Change the handle to something new to enable Save.";
    return "";
  })();

  async function saveProfile(e) {
    e.preventDefault();
    setProfileMessage("Saving profile...");

    const res = await fetch("/api/auth/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        notificationsEnabled,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.user) {
      setProfile((prev) => ({
        ...prev,
        firstName: data.user.firstName || prev.firstName,
        lastName: data.user.lastName || prev.lastName,
        email: data.user.email || prev.email,
        phone: data.user.phone || prev.phone,
        joinDate: data.user.joinDate || prev.joinDate,
      }));
    }

    setProfileMessage(res.ok ? "Profile updated" : data.message || "Failed to update profile");
  }

  async function saveCommunityUsername(e) {
    e.preventDefault();
    const parsed = tryNormalizeCommunityUsername(communityUsername);
    if (!parsed.ok) {
      setUsernameMessage(parsed.error);
      return;
    }
    const currentSaved = normalizeSavedUsernameHandle(savedCommunityUsername);
    if (currentSaved.length > 0 && parsed.normalized === currentSaved) {
      setUsernameMessage("No changes to save.");
      return;
    }
    if (loadingProfile || !profileLoadedOk) {
      setUsernameMessage("Still loading your account. Try again in a moment.");
      return;
    }
    setUsernameMessage("Saving…");
    try {
      const res = await fetch("/api/community/username", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: parsed.normalized }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.username === "string") {
        setCommunityUsername(data.username);
        setSavedCommunityUsername(data.username);
        setCommunityUsernameEditMode(false);
      }
      setUsernameMessage(res.ok ? "Username saved." : data.message || "Failed to save username.");
    } catch (err) {
      setUsernameMessage(err?.message || "Failed to save username.");
    }
  }

  async function saveSettings() {
    setSettingsMessage("Saving...");
    const res = await fetch("/api/reminder/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reminderFrequency: frequency,
        darkMode,
        ...(isPremium ? { fontPreset, fontSizePreset } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      applyThemePreference(darkMode);
      applyAppearancePreference({ fontPreset, fontSizePreset, isPremium });
      persistThemePreference({ scope: "auth", isDarkMode: darkMode });
      persistAppearancePreference({ fontPreset, fontSizePreset, isPremium });
    }
    setSettingsMessage(res.ok ? "Saved" : data.message || "Failed");
  }

  async function sendSummary() {
    setSettingsMessage("Sending summary email...");
    const res = await fetch("/api/reminder", { method: "GET" });
    const data = await res.json();
    setSettingsMessage(res.ok ? "Summary sent" : data.message || "Failed");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function saveLoginActivitySettings() {
    setLoginActivityMessage("Saving...");
    const res = await fetch("/api/auth/login-activity", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concurrentSessionLimit }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoginActivityMessage(data.message || "Failed to update concurrent device limit");
      return;
    }
    setLoginActivityMessage("Concurrent device limit updated");
    await loadLoginActivity();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-600">Update your profile and configure reminders and preferences.</p>
      </header>

      <section className="max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-black">Profile</h2>
        <p className="mt-1 text-xs text-zinc-500">
          {profile.joinDate ? `Joined on ${new Date(profile.joinDate).toLocaleDateString()}` : "Join date unavailable"}
        </p>

        {loadingProfile ? (
          <Loader className="mt-4" />
        ) : (
          <form onSubmit={saveProfile} className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              required
              value={profile.firstName}
              onChange={(e) => setProfile((v) => ({ ...v, firstName: e.target.value }))}
              placeholder="First name"
              className="rounded-xl border border-zinc-300 px-3 py-2"
            />
            <input
              required
              value={profile.lastName}
              onChange={(e) => setProfile((v) => ({ ...v, lastName: e.target.value }))}
              placeholder="Last name"
              className="rounded-xl border border-zinc-300 px-3 py-2"
            />
            <input
              required
              type="email"
              value={profile.email}
              onChange={(e) => setProfile((v) => ({ ...v, email: e.target.value }))}
              placeholder="Email"
              className="rounded-xl border border-zinc-300 px-3 py-2"
            />
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile((v) => ({ ...v, phone: e.target.value }))}
              placeholder="Phone"
              className="rounded-xl border border-zinc-300 px-3 py-2"
            />

            <label className="md:col-span-2 flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
              />
              Enable in-app notifications
            </label>

            <button
              type="submit"
              className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 md:col-span-2 md:justify-self-start"
            >
              Save Profile
            </button>

            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-zinc-400 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-black hover:bg-zinc-50 md:hidden"
            >
              Logout
            </button>
          </form>
        )}

        {profileMessage ? <p className="mt-3 text-sm text-zinc-600">{profileMessage}</p> : null}
      </section>

      <section
        className={`max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 ${profile.email && !savedCommunityUsername ? "ring-2 ring-amber-200" : ""}`}
      >
        <h2 className="text-base font-semibold text-black">Community username</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Unique @handle for community posts and replies. {COMMUNITY_USERNAME_MIN}–{COMMUNITY_USERNAME_MAX} characters (a–z, 0–9, _). Availability is checked as you type.
        </p>
        {profile.email && !savedCommunityUsername ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            You have not set a community username yet.
          </p>
        ) : null}
        {loadingProfile ? (
          <Loader className="mt-4" />
        ) : hasSavedCommunityUsername && !communityUsernameEditMode ? (
          <div className="mt-4 max-w-lg space-y-3">
            <div className="flex items-stretch gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
                <span className="shrink-0 text-sm text-zinc-500">@</span>
                <p className="min-w-0 truncate text-sm font-medium text-black">{savedNorm}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCommunityUsername(savedCommunityUsername);
                  setUsernameMessage("");
                  setCommunityUsernameEditMode(true);
                }}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 shadow-sm transition hover:bg-zinc-50"
                aria-label="Edit username"
              >
                <PenSquare className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="text-xs text-zinc-500">Use the edit button to change your handle.</p>
          </div>
        ) : (
          <form onSubmit={saveCommunityUsername} className="mt-4 space-y-3">
            <div
              className={`flex max-w-lg rounded-xl border bg-white ${
                usernameChecking
                  ? "border-zinc-300"
                  : usernameCheck?.available === true
                    ? "border-emerald-500"
                    : usernameCheck && usernameCheck.available === false
                      ? "border-rose-500"
                      : "border-zinc-300"
              }`}
            >
              <span className="flex items-center border-r border-zinc-200 px-3 text-sm text-zinc-500">@</span>
              <input
                id="community-username"
                value={communityUsername}
                onChange={(e) => setCommunityUsername(e.target.value)}
                placeholder="your_handle"
                autoComplete="username"
                maxLength={COMMUNITY_USERNAME_MAX}
                className="min-w-0 flex-1 rounded-r-xl px-3 py-2 text-sm outline-none"
                aria-label="Community username"
                aria-invalid={usernameCheck?.available === false}
              />
            </div>
            <div className="min-h-5 text-xs text-zinc-600">
              {usernameChecking ? (
                <span className="inline-flex items-center gap-1.5 text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Checking…
                </span>
              ) : usernameCheck?.status === "short" ? (
                <span className="text-amber-800">At least {COMMUNITY_USERNAME_MIN} characters ({usernameCheck.needed ?? ""} more).</span>
              ) : usernameCheck?.status === "long" ? (
                <span className="text-rose-600">Max {COMMUNITY_USERNAME_MAX} characters.</span>
              ) : usernameCheck?.status === "invalid_chars" ? (
                <span className="text-rose-600">Only a–z, 0–9, and underscore.</span>
              ) : usernameCheck?.status === "reserved" ? (
                <span className="text-rose-600">Reserved.</span>
              ) : usernameCheck?.status === "taken" ? (
                <span className="inline-flex items-center gap-1 text-rose-600">
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Taken
                </span>
              ) : usernameCheck?.status === "available" ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  Available
                </span>
              ) : usernameCheck?.status === "yours" ? (
                <span className="inline-flex items-center gap-1 text-zinc-500">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  Your current username
                </span>
              ) : usernameCheck?.configured === false ? (
                <span className="text-zinc-500">Community database not configured.</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={loadingProfile || !profileLoadedOk}
                className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save username
              </button>
              {hasSavedCommunityUsername ? (
                <button
                  type="button"
                  onClick={() => {
                    setCommunityUsername(savedCommunityUsername);
                    setUsernameMessage("");
                    setCommunityUsernameEditMode(false);
                  }}
                  className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
                >
                  Cancel
                </button>
              ) : null}
            </div>
            {saveUsernameHint ? (
              <p className="text-xs text-zinc-500" role="status">
                {saveUsernameHint}
              </p>
            ) : null}
          </form>
        )}
        {usernameMessage ? <p className="mt-3 text-sm text-zinc-600">{usernameMessage}</p> : null}
      </section>

      <section className="max-w-xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-black">App Preferences</h2>
        <label className="block text-sm text-zinc-700">Reminder Frequency</label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>

        <div className="space-y-2">
          <p className="text-sm text-zinc-700">Display Mode</p>
          <button
            type="button"
            aria-pressed={darkMode}
            onClick={() => {
              const next = !darkMode;
              setDarkMode(next);
              applyThemePreference(next);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:border-black hover:bg-zinc-50"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {darkMode ? "Light mode" : "Dark mode"}
          </button>
        </div>

        <div className="space-y-3 rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-black">Premium Typography</p>
              <p className="text-xs text-zinc-500">Choose from {FONT_PRESETS.length} font families, including Google fonts, and 10 size presets. Export styling follows your selection.</p>
            </div>
            {!isPremium ? <Lock className="h-4 w-4 text-zinc-400" /> : null}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Font Family</p>
            <select
              value={fontPreset}
              disabled={!isPremium}
              onChange={(e) => {
                if (!isPremium) return;
                const nextFontPreset = e.target.value;
                setFontPreset(nextFontPreset);
                applyAppearancePreference({ fontPreset: nextFontPreset, fontSizePreset, isPremium });
              }}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {FONT_PRESETS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Font Size</p>
            <select
              value={fontSizePreset}
              disabled={!isPremium}
              onChange={(e) => {
                if (!isPremium) return;
                const nextFontSizePreset = e.target.value;
                setFontSizePreset(nextFontSizePreset);
                applyAppearancePreference({ fontPreset, fontSizePreset: nextFontSizePreset, isPremium });
              }}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {FONT_SIZE_PRESETS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Live Preview</p>
            <p className="mt-3 text-sm text-zinc-600">This preview should change immediately when you pick a different premium font size.</p>
            <h3 className="mt-4 text-3xl font-semibold text-black">OWE DUE Preview</h3>
            <p className="mt-2 text-base text-zinc-700">Track dues, reminders, reports, and payment links with your selected typography.</p>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500">Sample label at xs size</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={saveSettings}
            className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 sm:w-auto"
          >
            Save Settings
          </button>
          <button
            onClick={sendSummary}
            className="rounded-xl border border-zinc-400 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-black hover:bg-zinc-50 sm:w-auto"
          >
            Send Pending Summary
          </button>
        </div>

        {settingsMessage ? <p className="text-sm text-zinc-600">{settingsMessage}</p> : null}
      </section>

      <section className="max-w-3xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-black">Login Activity</h2>
        <p className="text-sm text-zinc-600">
          Set how many devices can stay logged in at the same time. Maximum 5 devices.
        </p>

        <div className="grid gap-3 sm:grid-cols-[220px_auto] sm:items-end">
          <div>
            <label className="block text-sm text-zinc-700">Concurrent devices</label>
            <select
              value={concurrentSessionLimit}
              onChange={(e) => setConcurrentSessionLimit(Math.min(5, Math.max(1, Number(e.target.value))))}
              className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2"
            >
              <option value={1}>1 device</option>
              <option value={2}>2 devices</option>
              <option value={3}>3 devices</option>
              <option value={4}>4 devices</option>
              <option value={5}>5 devices</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveLoginActivitySettings}
              className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
            >
              Save Device Limit
            </button>
            <button
              type="button"
              onClick={loadLoginActivity}
              className="rounded-xl border border-zinc-400 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-black hover:bg-zinc-50"
            >
              Refresh Activity
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Recent login activity (last 5)</p>
          {loadingLoginActivity ? (
            <Loader className="mt-3" />
          ) : recentLogins.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No recent login activity available.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {recentLogins.map((item) => (
                <div key={item.sessionId} className="rounded-xl border border-zinc-200 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-black">{new Date(item.createdAt).toLocaleString()}</p>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                        item.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">IP: {item.ip || "Unknown"}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {loginActivityMessage ? <p className="text-sm text-zinc-600">{loginActivityMessage}</p> : null}
      </section>
    </div>
  );
}
