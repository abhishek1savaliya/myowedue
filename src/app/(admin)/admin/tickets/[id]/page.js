"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"];
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

export default function TicketDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState([]);
  const [managers, setManagers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [reply, setReply] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [assignManager, setAssignManager] = useState("");
  const [error, setError] = useState("");

  const loadTicket = useCallback(async () => {
    const res = await fetch(`/api/admin/tickets/${id}`);
    if (res.status === 401) { router.push("/admin/login"); return; }
    if (res.status === 404) { router.push("/admin/tickets"); return; }
    const json = await res.json();
    const t = json.ticket;
    setTicket(t);
    setStatus(t.status);
    setAssignManager(t.assignedManagers?.[0]?.id || "");
    setNotes(t.notes || "");
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    loadTicket();
    fetch("/api/admin/me").then((r) => r.json()).then((j) => setMe(j));
    // Load team members/managers for assignment controls
    fetch("/api/admin/team").then((r) => r.json()).then((j) => {
      setTeam(j.team || []);
      setManagers(j.managers || []);
    });
  }, [loadTicket]);

  const isSuperadmin = me?.role === "superadmin";
  const isManager = me?.role === "manager";
  const isSupport = me?.role === "support";

  const selectedManagerId = assignManager || ticket?.assignedManagers?.[0]?.id || "";
  const supportMembers = (team || []).filter((m) => {
    if (m.role !== "support" || !m.isActive) return false;
    return m.managerId === selectedManagerId;
  });

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = { status, notes };
      if (reply.trim()) body.reply = reply.trim();
      if (assignTo) body.assignTo = assignTo;
      if (isSuperadmin && assignManager && assignManager !== ticket?.assignedManagers?.[0]?.id) {
        body.assignManager = assignManager;
      }

      const res = await fetch(`/api/admin/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.message || "Error saving"); return; }
      setTicket(json.ticket);
      setStatus(json.ticket.status);
      setAssignManager(json.ticket.assignedManagers?.[0]?.id || "");
      setNotes(json.ticket.notes || "");
      setReply("");
      setAssignTo("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading ticket…</p>
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/tickets" className="text-sm text-gray-400 hover:text-amber-400 transition-colors">
          ← Back to tickets
        </Link>
      </div>

      {/* Ticket info */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">{ticket.name}</h1>
            <p className="text-sm text-gray-400">{ticket.email}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[ticket.status]}`}>
            {STATUS_LABELS[ticket.status]}
          </span>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap border-t border-gray-800 pt-3">
          {ticket.message}
        </p>
        <p className="text-xs text-gray-500">Received {new Date(ticket.createdAt).toLocaleString()}</p>

        {/* Assigned managers */}
        {ticket.assignedManagers?.length > 0 && (
          <div className="pt-1">
            <p className="text-xs text-gray-500 mb-1">Assigned managers:</p>
            <div className="flex flex-wrap gap-2">
              {ticket.assignedManagers.map((m) => (
                <span key={m.id} className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-gray-300">
                  {m.name} <span className="text-gray-500 font-mono">{m.employeeId}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {ticket.handledBy && (
          <div className="flex items-center gap-2 pt-1">
            <p className="text-xs text-gray-500">Handler:</p>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-600/20 px-2.5 py-0.5 text-xs text-emerald-400">
              {ticket.handledBy.name} · {ticket.handledBy.employeeId}
            </span>
          </div>
        )}
      </div>

      {/* Replies */}
      {ticket.replies.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-300">Replies ({ticket.replies.length})</h2>
          {ticket.replies.map((r, i) => (
            <div key={i} className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-amber-400">{r.adminName}</span>
                <span className="text-xs text-gray-500">{new Date(r.at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{r.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Action form */}
      <form onSubmit={handleSave} className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
        <h2 className="font-semibold text-white">Update Ticket</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Superadmin manager reassignment */}
          {isSuperadmin && (
            <div>
              <label className="mb-1 block text-xs text-gray-400">Assign Manager</label>
              <select
                value={assignManager}
                onChange={(e) => {
                  setAssignManager(e.target.value);
                  setAssignTo("");
                }}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">— Select manager —</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.employeeId})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="mb-1 block text-xs text-gray-400">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Handler reassignment: manager/superadmin only */}
          {!isSupport && (
            <div>
              <label className="mb-1 block text-xs text-gray-400">Assign to team member</label>
              <select
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">— Keep current —</option>
                {supportMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.employeeId})
                  </option>
                ))}
              </select>
              {supportMembers.length === 0 && (
                <p className="mt-1 text-[11px] text-gray-500">No active support members in selected manager's team.</p>
              )}
            </div>
          )}
        </div>

        {/* Reply */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">Add reply / note (internal)</label>
          <textarea
            rows={4}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply or internal update note…"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
          />
        </div>

        {/* Internal notes */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">Internal notes (visible to team only)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add internal notes…"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-gray-900 hover:bg-amber-400 disabled:opacity-60 transition-colors"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
