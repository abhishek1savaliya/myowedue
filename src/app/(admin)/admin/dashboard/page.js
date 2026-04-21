"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accent}`}>{value == null ? "-" : value.toLocaleString()}</p>
    </div>
  );
}

function StatusChip({ status }) {
  const map = {
    open: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    in_progress: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    resolved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    closed: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${map[status] || map.closed}`}>
      {String(status || "closed").replace("_", " ")}
    </span>
  );
}

function TicketLine({ t }) {
  return (
    <Link
      href={`/admin/tickets/${t.id}`}
      className="group flex items-center justify-between rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-3 transition hover:border-cyan-400/40"
    >
      <div className="min-w-0 pr-4">
        <p className="truncate text-sm font-semibold text-white">{t.name}</p>
        <p className="truncate text-xs text-slate-400">{t.message}</p>
      </div>
      <div className="flex items-center gap-2">
        <StatusChip status={t.status} />
        <span className="text-xs text-slate-500 group-hover:text-cyan-300">Open</span>
      </div>
    </Link>
  );
}

function ManagerDashboard({ admin }) {
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/tickets?page=1")
      .then((r) => {
        if (r.status === 401) {
          router.push("/admin/login");
          return null;
        }
        return r.json();
      })
      .then((j) => {
        if (!j) return;
        setTickets(j.tickets || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const open = tickets.filter((t) => t.status === "open").length;
  const active = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const closed = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;

  return (
    <section className="relative p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(45,212,191,0.12),transparent_35%),radial-gradient(circle_at_88%_88%,rgba(14,165,233,0.12),transparent_36%)]" />
      <div className="relative space-y-6">
        <div className="rounded-2xl border border-cyan-500/25 bg-slate-900/70 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-cyan-300">Manager Workspace</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Hello, {admin?.name}</h1>
          <p className="mt-1 text-sm text-slate-300">Monitor your queue, balance assignments, and unblock your team quickly.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total Queue" value={tickets.length} accent="text-cyan-300" />
          <StatCard label="Needs Attention" value={active} accent="text-amber-300" />
          <StatCard label="Completed" value={closed} accent="text-emerald-300" />
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Open First</h2>
            <div className="text-xs text-slate-400">Open: {open}</div>
          </div>
          {loading ? (
            <p className="text-sm text-slate-400">Loading tickets...</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-slate-500">No tickets assigned to your team yet.</p>
          ) : (
            <div className="space-y-2">{tickets.slice(0, 7).map((t) => <TicketLine key={t.id} t={t} />)}</div>
          )}
          <div className="mt-4">
            <Link href="/admin/tickets" className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-300 hover:text-cyan-200">
              Go to full ticket board
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function SupportDashboard({ admin }) {
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/tickets?page=1")
      .then((r) => {
        if (r.status === 401) {
          router.push("/admin/login");
          return null;
        }
        return r.json();
      })
      .then((j) => {
        if (!j) return;
        setTickets(j.tickets || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const active = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;

  return (
    <section className="relative p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(59,130,246,0.14),transparent_32%),radial-gradient(circle_at_90%_90%,rgba(16,185,129,0.1),transparent_35%)]" />
      <div className="relative space-y-6">
        <div className="rounded-2xl border border-blue-500/25 bg-slate-900/70 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-300">Support Desk</p>
          <h1 className="mt-2 text-3xl font-bold text-white">{admin?.name}</h1>
          <p className="mt-1 text-sm text-slate-300">Focus only on your assigned cases and keep response quality high.</p>
          {admin?.employeeId && <p className="mt-3 font-mono text-xs text-slate-500">Employee ID: {admin.employeeId}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Assigned to Me" value={tickets.length} accent="text-blue-300" />
          <StatCard label="Active Now" value={active} accent="text-amber-300" />
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">My Recent Cases</h2>
            <Link href="/admin/tickets" className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-300 hover:text-blue-200">
              View all
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : tickets.length === 0 ? (
            <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-300">No cases assigned yet</p>
              <p className="mt-1 text-xs text-slate-500">Your manager will route new tickets to you.</p>
            </div>
          ) : (
            <div className="space-y-2">{tickets.slice(0, 8).map((t) => <TicketLine key={t.id} t={t} />)}</div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Superadmin Dashboard ────────────────────────────────────────────────────
function SuperAdminDashboard({ admin }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (res.status === 401) {
        setLoading(false);
        router.push("/admin/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading stats...</p>
      </div>
    );
  }

  const { stats, recentUsers, monthlyTrend } = data || {};

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">Platform overview for {admin?.name || "super admin"}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Users" value={stats?.totalUsers} accent="text-blue-300" />
        <StatCard label="Total Transactions" value={stats?.totalTransactions} accent="text-emerald-300" />
        <StatCard label="Active Subscribers" value={stats?.activeSubscribers} accent="text-amber-300" />
        <StatCard label="New Users This Month" value={stats?.newUsersThisMonth} accent="text-fuchsia-300" />
        <StatCard label="Transactions This Month" value={stats?.newTransactionsThisMonth} accent="text-rose-300" />
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="mb-4 font-semibold text-white">User Growth (last 6 months)</h2>
        <div className="flex items-end gap-3 h-32">
          {(monthlyTrend || []).map((m) => {
            const max = Math.max(...(monthlyTrend || []).map((x) => x.users), 1);
            const pct = Math.max((m.users / max) * 100, 4);
            return (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-gray-400">{m.users}</span>
                <div className="w-full rounded-t-md bg-amber-500/70" style={{ height: `${pct}%` }} />
                <span className="text-xs text-gray-500">{m.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="mb-4 font-semibold text-white">Recent Signups</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Email</th>
                <th className="pb-2 pr-4 font-medium">Plan</th>
                <th className="pb-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {(recentUsers || []).map((u) => (
                <tr key={u.id} className="border-b border-gray-800/60 hover:bg-gray-800/40">
                  <td className="py-2.5 pr-4 text-white">{u.name}</td>
                  <td className="py-2.5 pr-4 text-gray-300">{u.email}</td>
                  <td className="py-2.5 pr-4">
                    {u.isPremium
                      ? <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">Premium</span>
                      : <span className="rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-400">Free</span>}
                  </td>
                  <td className="py-2.5 text-gray-400">{new Date(u.joinedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Root: detect role and render correct dashboard ──────────────────────────
export default function AdminDashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => {
        if (r.status === 401) {
          setUnauthorized(true);
          setLoading(false);
          router.push("/admin/login");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setAdmin(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading...</p>
      </div>
    );
  }

  if (unauthorized || !admin?.role) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">Redirecting to admin login...</p>
      </div>
    );
  }

  if (admin?.role === "manager")    return <ManagerDashboard admin={admin} />;
  if (admin?.role === "support")    return <SupportDashboard admin={admin} />;
  return <SuperAdminDashboard admin={admin} />;
}
