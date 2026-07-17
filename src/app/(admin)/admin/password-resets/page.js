"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_COLORS = {
  pending: "bg-amber-500/20 text-amber-300",
  issued: "bg-sky-500/20 text-sky-300",
  used: "bg-emerald-500/20 text-emerald-300",
  cancelled: "bg-zinc-700 text-zinc-400",
  expired: "bg-rose-500/20 text-rose-300",
};

export default function AdminPasswordResetsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [issued, setIssued] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ page: String(page) });
    if (statusFilter) qs.set("status", statusFilter);
    const res = await fetch(`/api/admin/password-resets?${qs}`);
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    const json = await res.json();
    if (!res.ok) {
      setError(json.message || "Failed to load requests");
      setLoading(false);
      return;
    }
    setRequests(json.requests || []);
    setTotal(json.total || 0);
    setPages(json.pages || 1);
    setLoading(false);
  }, [page, statusFilter, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function issueLink(id) {
    setActionId(id);
    setError("");
    setIssued(null);
    const res = await fetch(`/api/admin/password-resets/${id}`, { method: "POST" });
    const json = await res.json();
    setActionId(null);
    if (!res.ok) {
      setError(json.message || "Failed to create reset link");
      return;
    }
    setIssued(json.reset);
    await load();
  }

  async function cancelRequest(id) {
    if (!confirm("Cancel this password reset request?")) return;
    setActionId(id);
    const res = await fetch(`/api/admin/password-resets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    const json = await res.json();
    setActionId(null);
    if (!res.ok) {
      setError(json.message || "Failed to cancel");
      return;
    }
    await load();
  }

  async function copyText(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  return (
    <section className="relative p-4 pb-10 sm:p-6 sm:pb-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(251,191,36,0.1),transparent_34%),radial-gradient(circle_at_90%_100%,rgba(59,130,246,0.12),transparent_34%)]" />
      <div className="relative space-y-6">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Support</p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Password Reset Requests</h1>
          <p className="mt-1 text-sm text-slate-300">
            Users submit a request. Create a unique link and 6-digit code, then send them to the user manually. Links expire in 7 days.
          </p>
        </div>

        {issued ? (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-50">
            <p className="font-semibold text-amber-200">Reset credentials ready — send these to the user manually</p>
            <p className="mt-2 text-amber-100/90">Email: {issued.email}</p>
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-lg tracking-[0.2em] text-white">{issued.code}</span>
                <button
                  type="button"
                  onClick={() => copyText("code", issued.code)}
                  className="rounded-lg border border-amber-400/40 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-amber-100 hover:bg-amber-400/10"
                >
                  {copied === "code" ? "Copied" : "Copy code"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 break-all">
                <span className="text-amber-50/90">{issued.resetUrl}</span>
                <button
                  type="button"
                  onClick={() => copyText("link", issued.resetUrl)}
                  className="rounded-lg border border-amber-400/40 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-amber-100 hover:bg-amber-400/10"
                >
                  {copied === "link" ? "Copied" : "Copy link"}
                </button>
              </div>
              <p className="text-xs text-amber-200/70">
                Expires: {new Date(issued.expiresAt).toLocaleString()} (7 days)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIssued(null)}
              className="mt-4 text-xs font-semibold uppercase tracking-widest text-amber-200/80 underline underline-offset-2"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-400">{total} requests in this view</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { value: "", label: "Active" },
              { value: "all", label: "All" },
              { value: "pending", label: "Pending" },
              { value: "issued", label: "Issued" },
              { value: "used", label: "Used" },
              { value: "cancelled", label: "Cancelled" },
              { value: "expired", label: "Expired" },
            ].map(({ value, label }) => (
              <button
                key={value || "active"}
                type="button"
                onClick={() => {
                  setStatusFilter(value);
                  setPage(1);
                }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  statusFilter === value
                    ? "bg-amber-400 text-slate-900"
                    : "border border-slate-700 text-slate-400 hover:border-amber-400/40 hover:text-amber-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/70">
          {loading ? (
            <p className="p-6 text-sm text-slate-400">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No password reset requests.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {requests.map((item) => (
                <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-white">{item.email}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLORS[item.status] || STATUS_COLORS.pending}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Requested {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                      {item.expiresAt ? ` · Expires ${new Date(item.expiresAt).toLocaleString()}` : ""}
                    </p>
                    {item.issuedBy?.name ? (
                      <p className="text-xs text-slate-500">Issued by {item.issuedBy.name}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(item.status === "pending" || item.status === "issued" || item.status === "expired") && (
                      <button
                        type="button"
                        disabled={actionId === item.id}
                        onClick={() => issueLink(item.id)}
                        className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-900 disabled:opacity-60"
                      >
                        {actionId === item.id ? "Creating…" : item.status === "issued" ? "Re-issue link" : "Create link + code"}
                      </button>
                    )}
                    {(item.status === "pending" || item.status === "issued") && (
                      <button
                        type="button"
                        disabled={actionId === item.id}
                        onClick={() => cancelRequest(item.id)}
                        className="rounded-xl border border-slate-600 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300 hover:border-rose-400/50 hover:text-rose-200 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {pages > 1 ? (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-xs text-slate-400">
              Page {page} / {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
