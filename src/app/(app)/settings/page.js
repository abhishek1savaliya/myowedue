"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [frequency, setFrequency] = useState("weekly");
  const [darkMode, setDarkMode] = useState(false);
  const [message, setMessage] = useState("");

  async function saveSettings() {
    setMessage("Saving...");
    const res = await fetch("/api/reminder/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderFrequency: frequency, darkMode }),
    });
    const data = await res.json();
    setMessage(res.ok ? "Saved" : data.message || "Failed");
  }

  async function sendSummary() {
    setMessage("Sending summary email...");
    const res = await fetch("/api/reminder", { method: "GET" });
    const data = await res.json();
    setMessage(res.ok ? "Summary sent" : data.message || "Failed");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-600">Configure reminders, notifications and display preference.</p>
      </header>

      <section className="max-w-xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
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

        {message ? <p className="text-sm text-zinc-600">{message}</p> : null}
      </section>
    </div>
  );
}
