"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import BackButton from "@/components/BackButton";

const cardShadow =
  "shadow-[0_2px_8px_rgba(0,0,0,0.04),0_24px_48px_-12px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2),0_24px_48px_-12px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)]";

const inputClass =
  "w-full rounded-2xl border border-zinc-200/90 bg-zinc-50/80 px-4 py-3.5 text-[15px] text-zinc-900 outline-none transition duration-200 placeholder:text-zinc-400 hover:border-zinc-300/90 hover:bg-white/90 focus:border-amber-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(251,191,36,0.2)] focus:ring-0 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:hover:border-zinc-600 dark:focus:border-amber-500 dark:focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)] sm:py-4 sm:text-base";

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-500";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState("request");
  const [form, setForm] = useState({ email: "", otp: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function requestCode(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.message || "Could not send reset code");
      return;
    }

    setMessage(data.message || "If that email is registered, a reset code has been sent.");
    setStep("reset");
  }

  async function resetPassword(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (form.password !== form.confirmPassword) {
      setLoading(false);
      setError("Passwords do not match");
      return;
    }

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        otp: form.otp,
        password: form.password,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.message || "Could not reset password");
      return;
    }

    setMessage(data.message || "Password reset successful.");
    setTimeout(() => router.push("/login"), 1200);
  }

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 p-6 backdrop-blur-sm sm:rounded-3xl sm:p-8 md:p-10 dark:border-zinc-700/80 dark:bg-zinc-900/90 ${cardShadow}`}
    >
      <div className="mb-5">
        <BackButton href="/login" label="Back to login" />
      </div>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-amber-400 via-amber-500 to-amber-600 shadow-lg shadow-amber-500/30 ring-1 ring-amber-400/40 dark:shadow-amber-900/40 dark:ring-amber-500/30 sm:h-14 sm:w-14">
          <KeyRound className="h-6 w-6 text-white sm:h-7 sm:w-7" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-(family-name:--font-display) text-[1.65rem] font-semibold leading-tight tracking-[0.12em] text-zinc-900 sm:text-3xl dark:text-zinc-50">
            Reset Password
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {step === "request"
              ? "Enter your email and we will send a reset code."
              : "Enter the code from your email and choose a new password."}
          </p>
        </div>
      </header>

      {step === "request" ? (
        <form onSubmit={requestCode} className="mt-8 space-y-5">
          <div className="space-y-2">
            <label htmlFor="forgot-email" className={labelClass}>
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
              className={inputClass}
              required
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200/90 bg-red-50/95 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200" role="alert">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-linear-to-r from-amber-500 via-amber-500 to-amber-600 px-4 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-amber-500/25 transition hover:from-amber-500 hover:via-amber-600 hover:to-amber-600 disabled:opacity-60 sm:py-4"
          >
            {loading ? "Sending…" : "Send reset code"}
          </button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="mt-8 space-y-5">
          <div className="space-y-2">
            <label htmlFor="forgot-otp" className={labelClass}>
              Reset code
            </label>
            <input
              id="forgot-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              value={form.otp}
              onChange={(e) => setForm((v) => ({ ...v, otp: e.target.value }))}
              className={inputClass}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="forgot-password" className={labelClass}>
              New password
            </label>
            <input
              id="forgot-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
              className={inputClass}
              minLength={6}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="forgot-confirm-password" className={labelClass}>
              Confirm password
            </label>
            <input
              id="forgot-confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={(e) => setForm((v) => ({ ...v, confirmPassword: e.target.value }))}
              className={inputClass}
              minLength={6}
              required
            />
          </div>

          {message ? (
            <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/95 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-200/90 bg-red-50/95 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200" role="alert">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-linear-to-r from-amber-500 via-amber-500 to-amber-600 px-4 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-amber-500/25 transition hover:from-amber-500 hover:via-amber-600 hover:to-amber-600 disabled:opacity-60 sm:py-4"
          >
            {loading ? "Resetting…" : "Reset password"}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep("request");
              setError("");
              setMessage("");
            }}
            className="w-full text-sm text-zinc-600 underline underline-offset-2 dark:text-zinc-400"
          >
            Resend code
          </button>
        </form>
      )}

      <p className="mt-8 border-t border-zinc-100 pt-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-amber-600 underline decoration-amber-600/30 underline-offset-2 dark:text-amber-400">
          Sign in
        </Link>
      </p>
    </section>
  );
}
