"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import StatCard from "@/components/StatCard";
import MiniBarChart from "@/components/MiniBarChart";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";
import DashboardCurrencyConverter from "@/components/DashboardCurrencyConverter";
import { useCachedFetch } from "@/hooks/useCachedFetch";

export default function DashboardPage() {
  const [selectedCurrency, setSelectedCurrency] = useState("AUD");
  const cacheKey = `dashboard:${selectedCurrency}`;

  const { data, loading, error, revalidating } = useCachedFetch(
    cacheKey,
    `/api/dashboard?currency=${selectedCurrency}`,
    { deps: [selectedCurrency] }
  );

  const dashboardCurrency = data?.currency || selectedCurrency;
  const usdToSelectedRate = Number(data?.usdToSelectedRate || 1);

  const dueSummary = useMemo(() => {
    if (!data?.pending?.length) return { count: 0, text: "No pending dues" };
    const net = Number(data?.pendingNet || 0);
    const receivableAmount = Math.max(0, -net);
    if (receivableAmount <= 0) return { count: 0, text: "No pending dues" };
    return {
      count: data.pending.length,
      text: `${data.pending.length} pending dues • ${formatCurrency(receivableAmount, dashboardCurrency)} to receive`,
    };
  }, [data, dashboardCurrency]);

  const netBalance = (data?.totals?.totalReceivedBack || 0) - (data?.totals?.totalGiven || 0);

  if (loading && !data) return <Loader />;
  if (!data && error) {
    return <EmptyState text={`Dashboard failed to load: ${error}`} />;
  }
  if (!data) return <Loader />;

  return (
    <div className={`space-y-6 ${revalidating ? "opacity-[0.92]" : ""} transition-opacity`}>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Overview of receivables, payables, trends and dues.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="dashboard-currency" className="text-sm font-medium text-zinc-700">
            Dashboard Currency
          </label>
          <div className="flex items-center gap-2">
            <select
              id="dashboard-currency"
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              disabled={revalidating}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm disabled:cursor-wait disabled:opacity-70"
            >
              <option value="AUD">AUD</option>
              <option value="USD">USD</option>
              <option value="INR">INR</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
            {revalidating ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Updating…
              </span>
            ) : null}
          </div>
        </div>
        {error && data ? (
          <p className="mt-2 text-sm text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-zinc-600">
          Latest rate: 1 USD = {usdToSelectedRate.toFixed(4)} {dashboardCurrency}
          {data?.ratesUpdatedAt ? ` • Updated ${new Date(data.ratesUpdatedAt).toLocaleString()}` : ""}
        </p>
      </header>

      <DashboardCurrencyConverter />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Given"
          value={formatCurrency(data?.totals?.totalGiven || 0, dashboardCurrency)}
          numericValue={Number(data?.totals?.totalGiven || 0)}
          formatValue={(amount) => formatCurrency(amount, dashboardCurrency)}
          className="border-emerald-200 bg-linear-to-br from-emerald-50 to-white"
          titleClassName="text-emerald-700"
          valueClassName="text-emerald-800"
        />
        <StatCard
          title="Total Received Back"
          value={formatCurrency(data?.totals?.totalReceivedBack || 0, dashboardCurrency)}
          numericValue={Number(data?.totals?.totalReceivedBack || 0)}
          formatValue={(amount) => formatCurrency(amount, dashboardCurrency)}
          className="border-rose-200 bg-linear-to-br from-rose-50 to-white"
          titleClassName="text-rose-700"
          valueClassName="text-rose-800"
        />
        <StatCard
          title="Net (Received - Given)"
          value={`${netBalance >= 0 ? "+" : ""}${formatCurrency(netBalance, dashboardCurrency)}`}
          numericValue={netBalance}
          formatValue={(amount) => `${amount >= 0 ? "+" : ""}${formatCurrency(amount, dashboardCurrency)}`}
          subtitle={netBalance >= 0 ? "You owe person" : "Person owes you"}
          className="border-sky-200 bg-linear-to-br from-sky-50 via-cyan-50 to-white"
          titleClassName="text-sky-700"
          valueClassName="text-sky-800"
          subtitleClassName="text-sky-700"
        />
        <StatCard
          title="Pending Dues"
          value={String(dueSummary.count)}
          numericValue={Number(dueSummary.count || 0)}
          formatValue={(amount) => String(Math.round(amount))}
          subtitle={dueSummary.text}
          className="border-amber-200 bg-linear-to-br from-amber-50 to-white"
          titleClassName="text-amber-700"
          valueClassName="text-amber-800"
        />
        <StatCard
          title="People"
          value={String(data?.peopleCount || 0)}
          numericValue={Number(data?.peopleCount || 0)}
          formatValue={(amount) => String(Math.round(amount))}
          subtitle="Tracked contacts"
          className="border-violet-200 bg-linear-to-br from-violet-50 to-white"
          titleClassName="text-violet-700"
          valueClassName="text-violet-800"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <MiniBarChart title={`Monthly Insight (${dashboardCurrency})`} data={data?.monthlyInsights || []} xKey="month" aKey="credit" bKey="debit" />
        <MiniBarChart title={`Person-wise Insight (${dashboardCurrency})`} data={data?.personInsights || []} xKey="person" aKey="credit" bKey="debit" />
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
                  <p className="mt-1 text-zinc-600">
                    {formatCurrency(item.signedAmountInDashboardCurrency || 0, dashboardCurrency)} • {item.status}
                  </p>
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
                    <span className="text-zinc-600">{formatCurrency(item.signedAmountInDashboardCurrency || 0, dashboardCurrency)}</span>
                  </div>
                  <p className="mt-1 text-zinc-600">
                    {item.type.toUpperCase()} • {new Date(item.date).toLocaleDateString()}
                  </p>
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
