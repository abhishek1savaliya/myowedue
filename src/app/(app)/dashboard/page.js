"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";
import StatCard from "@/components/StatCard";
import MiniBarChart from "@/components/MiniBarChart";
import EmptyState from "@/components/EmptyState";

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    const json = await res.json();
    if (res.ok) setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const dueText = useMemo(() => {
    if (!data?.pending?.length) return "No pending dues";
    return `${data.pending.length} pending dues`; 
  }, [data]);

  const netBalance = (data?.totals?.totalReceive || 0) - (data?.totals?.totalPay || 0);

  if (loading) return <p className="text-sm text-zinc-600">Loading dashboard...</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-black">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600">Overview of receivables, payables, trends and dues.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Receive"
          value={formatCurrency(data?.totals?.totalReceive || 0)}
          className="border-emerald-200 bg-linear-to-br from-emerald-50 to-white"
          titleClassName="text-emerald-700"
          valueClassName="text-emerald-800"
        />
        <StatCard
          title="Total Pay"
          value={formatCurrency(data?.totals?.totalPay || 0)}
          className="border-rose-200 bg-linear-to-br from-rose-50 to-white"
          titleClassName="text-rose-700"
          valueClassName="text-rose-800"
        />
        <StatCard
          title="Net (Receive - Pay)"
          value={`${netBalance >= 0 ? "+" : ""}${formatCurrency(netBalance)}`}
          subtitle={netBalance >= 0 ? "Positive balance" : "Negative balance"}
          className="border-sky-200 bg-linear-to-br from-sky-50 via-cyan-50 to-white"
          titleClassName="text-sky-700"
          valueClassName="text-sky-800"
          subtitleClassName="text-sky-700"
        />
        <StatCard
          title="Pending Dues"
          value={String(data?.pending?.length || 0)}
          subtitle={dueText}
          className="border-amber-200 bg-linear-to-br from-amber-50 to-white"
          titleClassName="text-amber-700"
          valueClassName="text-amber-800"
        />
        <StatCard
          title="People"
          value={String(data?.peopleCount || 0)}
          subtitle="Tracked contacts"
          className="border-violet-200 bg-linear-to-br from-violet-50 to-white"
          titleClassName="text-violet-700"
          valueClassName="text-violet-800"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <MiniBarChart title="Monthly Insight" data={data?.monthlyInsights || []} xKey="month" aKey="credit" bKey="debit" />
        <MiniBarChart title="Person-wise Insight" data={data?.personInsights || []} xKey="person" aKey="credit" bKey="debit" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-fuchsia-200 bg-linear-to-br from-fuchsia-50 to-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-700">Recent Transactions</h2>
          <div className="mt-3 space-y-2">
            {data?.recent?.length ? (
              data.recent.map((item) => (
                <div key={item._id} className="rounded-xl border border-fuchsia-200 bg-white/80 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-black">{item.personId?.name || "Unknown"}</span>
                    <span className="text-zinc-600">{item.type.toUpperCase()}</span>
                  </div>
                  <p className="mt-1 text-zinc-600">{item.amount} {item.currency} • {item.status}</p>
                </div>
              ))
            ) : (
              <EmptyState text="No transactions available." />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-linear-to-br from-blue-50 to-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-700">Pending Dues</h2>
          <div className="mt-3 space-y-2">
            {data?.pending?.length ? (
              data.pending.map((item) => (
                <div key={item._id} className="rounded-xl border border-blue-200 bg-white/80 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-black">{item.personId?.name || "Unknown"}</span>
                    <span className="text-zinc-600">{item.amount} {item.currency}</span>
                  </div>
                  <p className="mt-1 text-zinc-600">{item.type.toUpperCase()} • {new Date(item.date).toLocaleDateString()}</p>
                </div>
              ))
            ) : (
              <EmptyState text="All clear. No pending entries." />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
