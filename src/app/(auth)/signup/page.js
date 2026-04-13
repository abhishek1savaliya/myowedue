"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
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

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-[0_20px_80px_rgba(0,0,0,0.08)]">
      <h1 className="text-2xl font-bold tracking-[0.12em] text-black">Create Account</h1>
      <p className="mt-2 text-sm text-zinc-600">Start tracking who owes and what you owe.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          type="text"
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none ring-black transition focus:ring-2"
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none ring-black transition focus:ring-2"
          required
        />
        <input
          type="password"
          placeholder="Password (min 6 chars)"
          value={form.password}
          onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none ring-black transition focus:ring-2"
          required
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          disabled={loading}
          className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-sm text-zinc-600">
        Already have an account? <Link href="/login" className="font-medium text-black underline">Sign in</Link>
      </p>
    </section>
  );
}
