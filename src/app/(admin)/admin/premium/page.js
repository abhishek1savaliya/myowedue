"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Crown, LayoutDashboard, RefreshCw } from "lucide-react";
import PremiumInsightsPanel from "@/components/admin/PremiumInsightsPanel";

export default function AdminPremiumPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/stats/premium", { cache: "no-store" });
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.message || "Failed to load premium analytics");
      setLoading(false);
      return;
    }
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Crown className="h-10 w-10 animate-pulse text-amber-400/50" />
        <p className="text-sm text-slate-400">Loading premium insights…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">{error}</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(251,191,36,0.1),transparent)]" />

      <div className="space-y-6 p-4 pb-10 sm:space-y-8 sm:p-6 sm:pb-12">
        <header className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-linear-to-br from-slate-900/95 via-slate-900/90 to-slate-950/95 px-6 py-8 shadow-xl shadow-black/30 md:px-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-400/50 to-transparent" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/90">
                <Crown className="h-3.5 w-3.5" strokeWidth={2} />
                Premium analytics
              </p>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">Pro subscriptions</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                Track upgrade clicks, purchase funnel steps, conversions, and revenue. Funnel events are recorded from
                the app; revenue comes from completed subscription payments.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto">
              <button
                type="button"
                onClick={load}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 sm:w-auto"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <Link
                href="/admin/dashboard"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/25 sm:w-auto"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </div>
          </div>
        </header>

        <PremiumInsightsPanel data={data} />
      </div>
    </div>
  );
}
