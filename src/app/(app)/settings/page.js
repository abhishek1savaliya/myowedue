"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Loader from "@/components/Loader";

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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileMessage, setProfileMessage] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");

  async function loadProfile() {
    setLoadingProfile(true);
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
      setDarkMode(Boolean(user.darkMode));
      setNotificationsEnabled(user.notificationsEnabled !== false);
    }

    setLoadingProfile(false);
  }

  useEffect(() => {
    loadProfile();
  }, []);

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

  async function saveSettings() {
    setSettingsMessage("Saving...");
    const res = await fetch("/api/reminder/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderFrequency: frequency, darkMode }),
    });
    const data = await res.json();
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

            <button type="submit" className="rounded-xl bg-black px-4 py-2 text-sm text-white md:col-span-2 md:justify-self-start">
              Save Profile
            </button>

            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-black px-4 py-2 text-sm text-black transition hover:bg-black hover:text-white md:hidden"
            >
              Logout
            </button>
          </form>
        )}

        {profileMessage ? <p className="mt-3 text-sm text-zinc-600">{profileMessage}</p> : null}
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

        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} />
          Enable dark mode preference
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button onClick={saveSettings} className="rounded-xl bg-black px-4 py-2 text-sm text-white sm:w-auto">
            Save Settings
          </button>
          <button onClick={sendSummary} className="rounded-xl border border-black px-4 py-2 text-sm sm:w-auto">
            Send Pending Summary
          </button>
        </div>

        {settingsMessage ? <p className="text-sm text-zinc-600">{settingsMessage}</p> : null}
      </section>
    </div>
  );
}
