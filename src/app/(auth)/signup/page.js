"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { applyAppearancePreference, applyThemePreference } from "@/lib/theme-client";
import {
  persistAppearancePreference,
  persistThemePreference,
} from "@/lib/cookie-preferences";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.message || "Signup failed");
      return;
    }

    if (data?.user) {
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
    <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="mb-1 flex items-center gap-3">
        <div className="rounded-lg bg-linear-to-br from-emerald-400 to-emerald-500 p-2">
          <UserPlus className="h-5 w-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-[0.18em] text-black">Create Account</h1>
      </div>
      <p className="mt-3 text-sm text-zinc-600">Start tracking who owes and what you owe.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">First Name</label>
            <input
              type="text"
              placeholder="John"
              value={form.firstName}
              onChange={(e) => setForm((v) => ({ ...v, firstName: e.target.value }))}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              required
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Last Name</label>
            <input
              type="text"
              placeholder="Doe"
              value={form.lastName}
              onChange={(e) => setForm((v) => ({ ...v, lastName: e.target.value }))}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              required
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Email</label>
          <input
            type="email"
            placeholder="your@email.com"
            value={form.email}
            onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            required
          />
        </div>
        
        <div>
          <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Phone <span className="text-zinc-400">(Optional)</span></label>
          <input
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={form.phone}
            onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        
        <div>
          <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Password <span className="text-zinc-400">(Min 6 chars)</span></label>
          <input
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            required
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          disabled={loading}
          className="w-full rounded-xl bg-linear-to-r from-emerald-400 to-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-60 mt-6"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-emerald-600 hover:text-emerald-700 transition">
          Sign in
        </Link>
      </p>
    </section>
  );
}
