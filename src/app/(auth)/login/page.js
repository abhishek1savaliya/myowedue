"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { applyAppearancePreference, applyThemePreference } from "@/lib/theme-client";

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

    if (data?.user && typeof data.user.darkMode === "boolean") {
      applyThemePreference(data.user.darkMode);
      applyAppearancePreference({
        fontPreset: data.user.fontPreset,
        fontSizePreset: data.user.fontSizePreset,
        isPremium: Boolean(data.user.isPremium),
      });
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="mb-1 flex items-center gap-3">
        <div className="rounded-lg bg-linear-to-br from-amber-400 to-amber-500 p-2">
          <LogIn className="h-5 w-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-[0.18em] text-black">Welcome Back</h1>
      </div>
      <p className="mt-3 text-sm text-zinc-600">Log in to manage credit, debit and dues.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Email</label>
          <input
            type="email"
            placeholder="your@email.com"
            value={form.email}
            onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            required
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            required
          />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.rememberMe}
            onChange={(e) => setForm((v) => ({ ...v, rememberMe: e.target.checked }))}
            className="h-4 w-4 rounded border border-zinc-300 accent-amber-500 cursor-pointer"
          />
          <span className="text-sm text-zinc-600">Keep me logged in for 7 days</span>
        </label>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          disabled={loading}
          className="w-full rounded-xl bg-linear-to-r from-amber-400 to-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:from-amber-500 hover:to-amber-600 disabled:opacity-60 mt-6"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-amber-600 hover:text-amber-700 transition">
          Create account
        </Link>
      </p>
    </section>
  );
}
