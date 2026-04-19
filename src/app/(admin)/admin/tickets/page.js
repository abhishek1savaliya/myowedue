"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STATUS_COLORS = {
  open: "bg-blue-500/20 text-blue-400",
  in_progress: "bg-amber-500/20 text-amber-400",
  resolved: "bg-emerald-500/20 text-emerald-400",
  closed: "bg-gray-700 text-gray-400",
};

const STATUS_LABELS = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export default function AdminTicketsPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page });
    if (statusFilter) qs.set("status", statusFilter);
    const res = await fetch(`/api/admin/tickets?${qs}`);
    if (res.status === 401) { router.push("/admin/login"); return; }
    const json = await res.json();
    setTickets(json.tickets || []);
    setTotal(json.total || 0);
    setPages(json.pages || 1);
    setLoading(false);
  }, [page, statusFilter, router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setMe(json))
      .catch(() => {});
  }, []);

  const openCount = tickets.filter((t) => t.status === "open").length;
  const progressCount = tickets.filter((t) => t.status === "in_progress").length;
  const doneCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;

  return (
    <section className="relative p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(45,212,191,0.1),transparent_34%),radial-gradient(circle_at_90%_100%,rgba(59,130,246,0.12),transparent_34%)]" />
      <div className="relative space-y-6">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {me?.role === "support" ? "Support Queue" : me?.role === "manager" ? "Manager Queue" : "Global Queue"}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            {me?.role === "support" ? "My Assigned Tickets" : me?.role === "manager" ? "My Team Tickets" : "All Support Tickets"}
          </h1>
          <p className="mt-1 text-sm text-slate-300">Track workload, filter statuses, and open any ticket for action.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Total</p>
            <p className="mt-2 text-2xl font-bold text-white">{total}</p>
          </div>
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-sky-300">Open</p>
            <p className="mt-2 text-2xl font-bold text-sky-200">{openCount}</p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-amber-300">In Progress</p>
            <p className="mt-2 text-2xl font-bold text-amber-200">{progressCount}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">Done</p>
            <p className="mt-2 text-2xl font-bold text-emerald-200">{doneCount}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-400">{total} tickets in this view</div>
          <div className="flex gap-2">
            {["", "open", "in_progress", "resolved", "closed"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  statusFilter === s
                    ? "bg-cyan-400 text-slate-900"
                    : "border border-slate-700 text-slate-400 hover:border-cyan-400/40 hover:text-cyan-200"
                }`}
              >
                {s === "" ? "All" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 overflow-hidden">
        {loading ? (
          <p className="p-6 text-slate-400 animate-pulse">Loading tickets...</p>
        ) : tickets.length === 0 ? (
          <p className="p-6 text-slate-400">No tickets found for this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="px-4 pb-3 pt-4 font-medium">From</th>
                  <th className="px-4 pb-3 pt-4 font-medium">Message</th>
                  <th className="px-4 pb-3 pt-4 font-medium">Status</th>
                  {me?.role === "superadmin" && <th className="px-4 pb-3 pt-4 font-medium">Manager</th>}
                  <th className="px-4 pb-3 pt-4 font-medium">Handler</th>
                  <th className="px-4 pb-3 pt-4 font-medium">Replies</th>
                  <th className="px-4 pb-3 pt-4 font-medium">Date</th>
                  <th className="px-4 pb-3 pt-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="border-b border-slate-700/60 hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{t.name}</div>
                      <div className="text-slate-500 text-xs">{t.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-xs truncate">{t.message}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status]}`}>
                        {STATUS_LABELS[t.status]}
                      </span>
                    </td>
                    {me?.role === "superadmin" && (
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {t.assignedManager
                          ? <span>{t.assignedManager.name}<br /><span className="font-mono">{t.assignedManager.employeeId}</span></span>
                          : <span className="text-slate-600">Unassigned</span>}
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {t.handledBy ? (
                        <span>{t.handledBy.name}<br /><span className="font-mono">{t.handledBy.employeeId}</span></span>
                      ) : (
                        <span className="text-slate-600">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-400">{t.repliesCount}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/tickets/${t.id}`}
                        className="rounded-full px-3 py-1 text-xs border border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-cyan-200 transition-colors"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center gap-2 text-slate-300">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-full border border-slate-700 px-3 py-1.5 text-sm hover:border-cyan-400 hover:text-cyan-200 disabled:opacity-40 transition-colors"
          >
            Prev
          </button>
          <span className="text-sm text-slate-400">Page {page} of {pages}</span>
          <button
            disabled={page === pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border border-slate-700 px-3 py-1.5 text-sm hover:border-cyan-400 hover:text-cyan-200 disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      )}
      </div>
    </section>
  );
}
