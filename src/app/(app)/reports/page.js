"use client";

import { useEffect, useRef, useState } from "react";
import { toJpeg } from "html-to-image";
import { formatCurrency } from "@/lib/currency";

export default function ReportsPage() {
  const cardRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadSnapshot() {
      setLoading(true);
      try {
        const [dashboardRes, meRes] = await Promise.all([
          fetch("/api/dashboard?currency=AUD", { cache: "no-store" }),
          fetch("/api/auth/me", { cache: "no-store" }),
        ]);
        const [dashboardData, meData] = await Promise.all([
          dashboardRes.json().catch(() => ({})),
          meRes.json().catch(() => ({})),
        ]);
        if (!ignore && dashboardRes.ok) {
          setSnapshot(dashboardData);
        }
        if (!ignore && meRes.ok) {
          setUser(meData.user || null);
        }
      } catch (error) {
        console.error("Failed to load report snapshot:", error);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadSnapshot();
    return () => {
      ignore = true;
    };
  }, []);

  async function downloadJpg() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toJpeg(cardRef.current, {
        quality: 0.95,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = "dues-share.jpg";
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("JPG export failed:", error);
      window.alert("Could not generate JPG right now. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  const currency = snapshot?.currency || "AUD";
  const totalGiven = Number(snapshot?.totals?.totalGiven || 0);
  const totalReceived = Number(snapshot?.totals?.totalReceivedBack || 0);
  const net = totalReceived - totalGiven;
  const recent = snapshot?.recent || [];
  const isPremium = Boolean(user?.isPremium);
  const averageTransaction = recent.length
    ? recent.reduce((sum, item) => sum + Math.abs(Number(item.signedAmountInDashboardCurrency || 0)), 0) / recent.length
    : 0;
  const collectionEfficiency = totalGiven > 0 ? Math.min(100, Math.round((totalReceived / totalGiven) * 100)) : 0;
  const openExposure = Math.abs(net);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-zinc-600">Download PDF/CSV reports and share as image.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <a
          href={isPremium ? "/api/export/pdf" : "#"}
          className={`rounded-2xl p-4 text-center text-sm font-medium ${
            isPremium ? "border border-black bg-black text-white" : "border border-zinc-200 bg-zinc-100 text-zinc-400"
          }`}
        >
          {isPremium ? "Download Premium PDF" : "Premium PDF Export"}
        </a>
        <a
          href={isPremium ? "/api/export?type=excel" : "/api/export?type=csv"}
          className="rounded-2xl border border-zinc-300 bg-white p-4 text-center text-sm font-medium text-black"
        >
          {isPremium ? "Download Premium Excel" : "Download CSV"}
        </a>
        <button
          onClick={downloadJpg}
          className="rounded-2xl border border-zinc-300 bg-white p-4 text-sm font-medium text-black"
        >
          {downloading ? "Generating JPG..." : "Export as JPG"}
        </button>
      </div>

      {!isPremium ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Free plan includes a basic report snapshot. Upgrade in Settings to unlock advanced insights, premium PDF export, Excel export, recurring-dues intelligence, and priority support.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Collection Efficiency</p>
            <p className="mt-2 text-2xl font-semibold text-black">{collectionEfficiency}%</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Average Recent Transaction</p>
            <p className="mt-2 text-2xl font-semibold text-black">{formatCurrency(averageTransaction, currency)}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Open Exposure</p>
            <p className="mt-2 text-2xl font-semibold text-black">{formatCurrency(openExposure, currency)}</p>
          </div>
        </div>
      )}

      <div
        ref={cardRef}
        className="max-w-2xl rounded-3xl border border-zinc-300 bg-white p-5 shadow-[0_20px_70px_rgba(0,0,0,0.1)] sm:p-8"
      >
        <h2 className="text-2xl font-semibold tracking-[0.08em]">Dues Snapshot</h2>
        <p className="mt-2 text-sm text-zinc-600">Personal Credit/Debit Manager</p>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-700">Total Given</p>
            <p className="mt-1 text-sm font-semibold text-emerald-900">{formatCurrency(totalGiven, currency)}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-rose-700">Total Received</p>
            <p className="mt-1 text-sm font-semibold text-rose-900">{formatCurrency(totalReceived, currency)}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-sky-700">Net Balance</p>
            <p className="mt-1 text-sm font-semibold text-sky-900">{`${net >= 0 ? "+" : ""}${formatCurrency(net, currency)}`}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          <p>Pending entries: <span className="font-semibold">{loading ? "..." : String(snapshot?.notificationCount || 0)}</span></p>
          <p>People tracked: <span className="font-semibold">{loading ? "..." : String(snapshot?.peopleCount || 0)}</span></p>
          <p>Generated: <span className="font-semibold">{new Date().toLocaleString()}</span></p>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-600">Recent Transactions</p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700">
            {loading ? (
              <li>Loading latest entries...</li>
            ) : recent.length ? (
              recent.slice(0, 3).map((item) => (
                <li key={item._id || `${item.personId?.name || "unknown"}-${item.date}`}>
                  {item.personId?.name || "Unknown"} - {formatCurrency(item.signedAmountInDashboardCurrency || 0, currency)} - {new Date(item.date).toLocaleDateString()}
                </li>
              ))
            ) : (
              <li>No recent entries.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
