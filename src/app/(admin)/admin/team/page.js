"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppAlert } from "@/components/AppAlertProvider";
import { adminSelect } from "@/components/admin/admin-shell";

const ROLES_SUPERADMIN = ["support", "manager", "superadmin"];

function SuperadminRoleEditor({ member, managers, viewerId, soleSuperadmin, onSaved, showAlert }) {
  const [role, setRole] = useState(member.role);
  const [managerId, setManagerId] = useState(member.managerId || "");
  const [saving, setSaving] = useState(false);

  const isSelf = member.id === viewerId;
  const lockedSoleSuperadmin = isSelf && soleSuperadmin;

  useEffect(() => {
    setRole(member.role);
    setManagerId(member.managerId || "");
  }, [member.id, member.role, member.managerId]);

  const dirty =
    role !== member.role ||
    (role === "support" && (managerId || "") !== (member.managerId || ""));

  const peerOtherSuperadmin = member.role === "superadmin" && !isSelf;

  async function save() {
    if (lockedSoleSuperadmin) return;
    let mid = managerId;
    if (role === "support") {
      if (!mid && managers.length > 0) mid = managers[0].id;
      if (!mid) {
        showAlert("Select a manager for the support role.", { severity: "error" });
        return;
      }
    }
    setSaving(true);
    try {
      const body = { role };
      if (role === "support") body.managerId = mid;
      const res = await fetch(`/api/admin/team/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAlert(json.message || "Could not update role.", { severity: "error" });
        return;
      }
      if (json.pendingApproval) {
        showAlert(json.message || "The other superadmin must approve this change.", { severity: "info" });
        onSaved();
        return;
      }
      showAlert("Role updated.", { severity: "success" });
      onSaved();
    } catch {
      showAlert("Network error — could not update role.", { severity: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full min-w-44 max-w-60 flex-col gap-1.5">
      {lockedSoleSuperadmin ? (
        <p className="text-[11px] leading-snug text-amber-400/90">
          You are the only active superadmin. Add another superadmin before you can change your own role.
        </p>
      ) : null}
      <select
        value={role}
        disabled={lockedSoleSuperadmin}
        onChange={(e) => {
          const r = e.target.value;
          setRole(r);
          if (r === "support" && !managerId && managers[0]) setManagerId(managers[0].id);
        }}
        className={`${adminSelect} px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {ROLES_SUPERADMIN.map((r) => (
          <option key={r} value={r}>
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </option>
        ))}
      </select>
      {role === "support" && (
        <select
          value={managerId}
          disabled={lockedSoleSuperadmin}
          onChange={(e) => setManagerId(e.target.value)}
          className={`${adminSelect} px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <option value="">Select manager</option>
          {managers.map((mgr) => (
            <option key={mgr.id} value={mgr.id}>
              {mgr.name} ({mgr.employeeId})
            </option>
          ))}
        </select>
      )}
      {dirty && !lockedSoleSuperadmin && (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded border border-amber-600/50 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
        >
          {saving ? "Sending…" : peerOtherSuperadmin ? "Request role change" : "Save role"}
        </button>
      )}
    </div>
  );
}

function CredsBox({ creds, onDismiss, title = "✅ Credentials — share with employee" }) {
  const [copied, setCopied] = useState(false);
  function copyAll() {
    const text = `Email: ${creds.email}\nEmployee ID: ${creds.employeeId}\nPassword: ${creds.password}`;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-emerald-400">{title}</h3>
        <button
          onClick={copyAll}
          className="rounded px-3 py-1 text-xs border border-emerald-600/40 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
        >
          {copied ? "Copied!" : "Copy all"}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-gray-900/60 px-3 py-2">
          <p className="text-xs text-gray-400 mb-1">Email</p>
          <p className="font-mono text-white break-all">{creds.email}</p>
        </div>
        <div className="rounded-lg bg-gray-900/60 px-3 py-2">
          <p className="text-xs text-gray-400 mb-1">Employee ID</p>
          <p className="font-mono text-white">{creds.employeeId}</p>
        </div>
        <div className="rounded-lg bg-gray-900/60 px-3 py-2">
          <p className="text-xs text-gray-400 mb-1">Password</p>
          <p className="font-mono text-amber-400 font-bold tracking-wider">{creds.password}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500">⚠ This password will not be shown again. Copy and share it now.</p>
      <button onClick={onDismiss} className="text-xs text-gray-400 underline">Dismiss</button>
    </div>
  );
}

export default function AdminTeamPage() {
  const { showAlert } = useAppAlert();
  const router = useRouter();
  const [team, setTeam] = useState([]);
  const [managers, setManagers] = useState([]);
  const [viewerRole, setViewerRole] = useState("");
  const [viewerId, setViewerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "support", managerId: "" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [creds, setCreds] = useState(null); // latest creds to display (new create)
  const [resetLoading, setResetLoading] = useState(null); // member id being reset
  const [eyeLoading, setEyeLoading] = useState({}); // { [memberId]: boolean }
  const [rowPasswords, setRowPasswords] = useState({}); // { [memberId]: password }
  const [rowPasswordVisible, setRowPasswordVisible] = useState({}); // { [memberId]: boolean }
  const [soleSuperadmin, setSoleSuperadmin] = useState(false);
  const [peerRequests, setPeerRequests] = useState({ incoming: [], outgoing: [] });
  const [peerActionLoading, setPeerActionLoading] = useState(null);

  async function loadTeam() {
    const res = await fetch("/api/admin/team");
    if (res.status === 401) { router.push("/admin/login"); return; }
    const json = await res.json();
    setTeam(json.team || []);
    setManagers(json.managers || []);
    setViewerRole(json.viewerRole || "");
    setViewerId(json.viewerId || "");
    setSoleSuperadmin(Boolean(json.soleSuperadmin));
    setPeerRequests(json.peerRequests || { incoming: [], outgoing: [] });

    const preloaded = {};
    for (const member of json.team || []) {
      if (member.passwordPreview) {
        preloaded[member.id] = member.passwordPreview;
      }
    }
    setRowPasswords(preloaded);

    setLoading(false);
  }

  useEffect(() => { loadTeam(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.message || `Error ${res.status}: Could not create employee.`);
        return;
      }
      setCreds({
        email: json.member.email,
        employeeId: json.member.employeeId,
        password: json.generatedPassword,
      });
      setShowForm(false);
      setForm({ name: "", email: "", role: "support", managerId: "" });
      loadTeam();
    } catch {
      setFormError("Network error — check your connection and try again.");
    } finally {
      setFormLoading(false);
    }
  }

  async function toggleActive(member) {
    try {
      const res = await fetch(`/api/admin/team/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !member.isActive }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAlert(json.message || "Could not update status.", { severity: "error" });
        return;
      }
      if (json.pendingApproval) {
        showAlert(json.message || "The other superadmin must approve this change.", { severity: "info" });
      }
      loadTeam();
    } catch {
      showAlert("Network error.", { severity: "error" });
    }
  }

  async function deleteMember(id) {
    if (!confirm("Delete this team member? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/team/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAlert(json.message || "Could not delete member.", { severity: "error" });
        return;
      }
      if (json.pendingApproval) {
        showAlert(json.message || "The other superadmin must approve this deletion.", { severity: "info" });
      }
      loadTeam();
    } catch {
      showAlert("Network error.", { severity: "error" });
    }
  }

  async function respondPeerRequest(requestId, decision) {
    setPeerActionLoading(`${requestId}:${decision}`);
    try {
      const res = await fetch(`/api/admin/team/peer-requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAlert(json.message || "Could not update request.", { severity: "error" });
        return;
      }
      showAlert(decision === "accept" ? "Request accepted." : "Request rejected.", {
        severity: decision === "accept" ? "success" : "info",
      });
      loadTeam();
    } catch {
      showAlert("Network error.", { severity: "error" });
    } finally {
      setPeerActionLoading(null);
    }
  }

  function describePeerRequest(req) {
    if (req.kind === "delete") {
      return "requested to remove your account";
    }
    const p = req.proposedPatch || {};
    const parts = [];
    if (p.role) parts.push(`role → ${p.role}`);
    if (p.isActive === false) parts.push("disable account");
    if (p.isActive === true) parts.push("enable account");
    return parts.length ? `requested: ${parts.join(", ")}` : "requested a profile update";
  }

  async function resetPassword(member) {
    if (!member.canViewPassword) return;
    if (!confirm(`Reset password for ${member.name}? A new password will be generated.`)) return;
    setCreds(null);
    setResetLoading(member.id);
    try {
      const res = await fetch(`/api/admin/team/${member.id}/reset-password`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        showAlert(json.message || "Failed to reset password.", { severity: "error" });
        return;
      }
      const newPassword = json?.newPassword || json?.data?.newPassword || "";
      if (!newPassword) {
        showAlert("Password reset succeeded, but password value was not returned.", { severity: "warning" });
        return;
      }
      // Show password inline in the row immediately.
      setRowPasswords((prev) => ({ ...prev, [member.id]: newPassword }));
      setRowPasswordVisible((prev) => ({ ...prev, [member.id]: true }));
      showAlert("Password reset successfully.", { severity: "success" });
    } catch {
      showAlert("Network error - could not reset password.", { severity: "error" });
    } finally {
      setResetLoading(null);
    }
  }

  async function handleEyeToggle(member) {
    if (!member.canViewPassword) return;

    // If already have a password preview, just toggle visibility.
    if (rowPasswords[member.id]) {
      setRowPasswordVisible((prev) => ({ ...prev, [member.id]: !prev[member.id] }));
      return;
    }

    // No preview available: auto-generate a new password and reveal it.
    setEyeLoading((prev) => ({ ...prev, [member.id]: true }));
    try {
      const res = await fetch(`/api/admin/team/${member.id}/reset-password`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        showAlert(json.message || "Unable to generate password.", { severity: "error" });
        return;
      }
      const newPassword = json?.newPassword || json?.data?.newPassword || "";
      if (!newPassword) {
        showAlert("Password generated but not returned by server.", { severity: "warning" });
        return;
      }

      setRowPasswords((prev) => ({ ...prev, [member.id]: newPassword }));
      setRowPasswordVisible((prev) => ({ ...prev, [member.id]: true }));
      showAlert("Password generated.", { severity: "success" });
    } catch {
      showAlert("Network error while generating password.", { severity: "error" });
    } finally {
      setEyeLoading((prev) => ({ ...prev, [member.id]: false }));
    }
  }

  return (
    <div className="space-y-6 p-4 pb-10 sm:p-6 sm:pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">Team</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {viewerRole === "support"
              ? "Your manager and teammates (view only)"
              : viewerRole === "manager"
                ? "Your team — you can add support members only"
                : "Manage employees"}
          </p>
        </div>
        {(viewerRole === "superadmin" || viewerRole === "manager") && (
          <button
            onClick={() => {
              setShowForm((v) => !v);
              setCreds(null);
              setFormError("");
              setForm((f) =>
                viewerRole === "manager"
                  ? { name: "", email: "", role: "support", managerId: viewerId }
                  : { ...f, name: "", email: "" }
              );
            }}
            className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-amber-400 sm:w-auto"
          >
            {showForm ? "Cancel" : "+ Add Employee"}
          </button>
        )}
      </div>

      {/* Credentials display (create or reset) */}
      {creds && (
        <CredsBox creds={creds} onDismiss={() => setCreds(null)} />
      )}

      {viewerRole === "superadmin" && peerRequests.incoming?.length > 0 ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-amber-200">Pending requests (your approval)</h2>
          <p className="text-xs text-amber-200/70">
            Another superadmin proposed a sensitive change to your account. Nothing changes until you accept.
          </p>
          <ul className="space-y-3">
            {peerRequests.incoming.map((req) => (
              <li
                key={req.id}
                className="rounded-lg border border-amber-500/25 bg-gray-900/60 px-3 py-3 text-sm text-gray-200"
              >
                <p className="font-medium text-white">
                  {req.requestedBy?.name || "Superadmin"}{" "}
                  <span className="font-normal text-gray-400">({describePeerRequest(req)})</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={Boolean(peerActionLoading)}
                    onClick={() => respondPeerRequest(req.id, "accept")}
                    className="rounded border border-emerald-600/50 bg-emerald-900/30 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-900/50 disabled:opacity-50"
                  >
                    {peerActionLoading === `${req.id}:accept` ? "…" : "Accept"}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(peerActionLoading)}
                    onClick={() => respondPeerRequest(req.id, "reject")}
                    className="rounded border border-rose-600/50 bg-rose-900/30 px-3 py-1 text-xs font-medium text-rose-300 hover:bg-rose-900/50 disabled:opacity-50"
                  >
                    {peerActionLoading === `${req.id}:reject` ? "…" : "Reject"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {viewerRole === "superadmin" && peerRequests.outgoing?.length > 0 ? (
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/30 p-4">
          <h2 className="text-sm font-semibold text-cyan-200">Waiting on their approval</h2>
          <ul className="mt-2 space-y-2 text-xs text-cyan-100/80">
            {peerRequests.outgoing.map((req) => (
              <li key={req.id}>
                <span className="font-medium text-cyan-100">{req.target?.name}</span>
                {" — "}
                {req.kind === "delete" ? "account removal" : "role / status change"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Add form */}
      {showForm && (
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
          <h2 className="mb-4 font-semibold text-white">New Employee</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-gray-400">Full Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g. Jane Smith"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-400">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                placeholder="jane@example.com"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-400">Role</label>
              {viewerRole === "manager" ? (
                <p className="rounded-lg border border-gray-700 bg-gray-800/80 px-3 py-2 text-sm text-gray-300">Support</p>
              ) : (
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value,
                      managerId: e.target.value === "support" ? form.managerId : "",
                    })
                  }
                  className={adminSelect}
                >
                  {ROLES_SUPERADMIN.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {form.role === "support" && viewerRole === "superadmin" && (
              <div>
                <label className="mb-1 block text-sm text-gray-400">Assign Manager</label>
                <select
                  value={form.managerId}
                  onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                  required
                  className={adminSelect}
                >
                  <option value="">Select manager</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.employeeId})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {form.role === "support" && viewerRole === "manager" && (
              <div>
                <label className="mb-1 block text-sm text-gray-400">Manager</label>
                <p className="rounded-lg border border-gray-700 bg-gray-800/80 px-3 py-2 text-sm text-gray-300">
                  Assigned to your team automatically
                </p>
              </div>
            )}
            {/* Error banner */}
            {formError && (
              <div className="sm:col-span-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                ⚠ {formError}
              </div>
            )}
            <div className="sm:col-span-3 flex gap-3">
              <button
                type="submit"
                disabled={formLoading}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-amber-400 disabled:opacity-60 transition-colors"
              >
                {formLoading ? "Creating…" : "Create & Generate Password"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(""); }}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Team table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-400 animate-pulse">Loading…</p>
        ) : team.length === 0 ? (
          <p className="p-6 text-gray-400">No team members yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="w-[18%] px-4 pb-3 pt-4 font-medium">Employee</th>
                  <th className="w-[10%] whitespace-nowrap px-4 pb-3 pt-4 font-medium">ID</th>
                  <th className="w-[14%] px-4 pb-3 pt-4 font-medium">Role</th>
                  <th className="w-[12%] px-4 pb-3 pt-4 font-medium">Manager</th>
                  <th className="w-[8%] whitespace-nowrap px-4 pb-3 pt-4 font-medium">Status</th>
                  <th className="w-[14%] px-4 pb-3 pt-4 font-medium">Password</th>
                  <th className="w-[14%] whitespace-nowrap px-4 pb-3 pt-4 font-medium">Last Login</th>
                  <th className="w-[10%] px-4 pb-3 pt-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id} className="border-b border-gray-800/60 hover:bg-gray-800/40">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{m.name}</div>
                      <div className="text-gray-500 text-xs">{m.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-300 whitespace-nowrap">{m.employeeId}</td>
                    <td className="px-4 py-3 align-top wrap-break-word">
                      {viewerRole === "superadmin" ? (
                        <SuperadminRoleEditor
                          member={m}
                          managers={managers}
                          viewerId={viewerId}
                          soleSuperadmin={soleSuperadmin}
                          onSaved={loadTeam}
                          showAlert={showAlert}
                        />
                      ) : (
                        <span
                          className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize whitespace-nowrap ${
                            m.role === "superadmin"
                              ? "bg-amber-500/20 text-amber-400"
                              : m.role === "manager"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-gray-700 text-gray-300"
                          }`}
                        >
                          {m.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {m.role === "support"
                        ? (m.managerName || "Unassigned")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 align-middle whitespace-nowrap">
                      <span
                        className={`inline-flex w-max max-w-none shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                          m.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {m.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    {/* Password column — shows after reset, hidden otherwise */}
                    <td className="px-4 py-3">
                      {!m.canViewPassword ? (
                        <span className="text-xs text-gray-600">—</span>
                      ) : (
                        <div className="flex flex-nowrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-400 tracking-wider select-all">
                            {rowPasswords[m.id]
                              ? (rowPasswordVisible[m.id] ? rowPasswords[m.id] : "••••••••••")
                              : "••••••••••"}
                          </span>
                          <button
                            type="button"
                            disabled={Boolean(eyeLoading[m.id])}
                            onClick={() => handleEyeToggle(m)}
                            className="rounded border border-gray-700 px-2 py-0.5 text-[11px] text-gray-300 hover:border-amber-500 hover:text-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            title={
                              eyeLoading[m.id]
                                ? "Generating password..."
                                : !rowPasswords[m.id]
                                ? "Generate and show password"
                                : rowPasswordVisible[m.id]
                                ? "Hide password"
                                : "Show password"
                            }
                          >
                            {eyeLoading[m.id] ? "..." : rowPasswordVisible[m.id] ? "🙈" : "👁"}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {m.lastLogin ? new Date(m.lastLogin).toLocaleString() : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {viewerRole === "superadmin" && m.id !== viewerId && (
                          <>
                            <button
                              onClick={() => toggleActive(m)}
                              className="rounded px-2 py-1 text-xs border border-gray-700 text-gray-400 hover:border-amber-500 hover:text-amber-400 transition-colors"
                            >
                              {m.isActive ? "Disable" : "Enable"}
                            </button>
                            <button
                              onClick={() => resetPassword(m)}
                              disabled={resetLoading === m.id}
                              className="rounded px-2 py-1 text-xs border border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-400 disabled:opacity-50 transition-colors"
                            >
                              {resetLoading === m.id ? "Resetting…" : "🔑 Reset Password"}
                            </button>
                            <button
                              onClick={() => deleteMember(m.id)}
                              className="rounded px-2 py-1 text-xs border border-gray-700 text-gray-400 hover:border-red-500 hover:text-red-400 transition-colors"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {viewerRole === "manager" && m.role === "support" && m.managerId === viewerId && (
                          <>
                            <button
                              onClick={() => toggleActive(m)}
                              className="rounded px-2 py-1 text-xs border border-gray-700 text-gray-400 hover:border-amber-500 hover:text-amber-400 transition-colors"
                            >
                              {m.isActive ? "Disable" : "Enable"}
                            </button>
                            <button
                              onClick={() => resetPassword(m)}
                              disabled={resetLoading === m.id}
                              className="rounded px-2 py-1 text-xs border border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-400 disabled:opacity-50 transition-colors"
                            >
                              {resetLoading === m.id ? "Resetting…" : "🔑 Reset Password"}
                            </button>
                            <button
                              onClick={() => deleteMember(m.id)}
                              className="rounded px-2 py-1 text-xs border border-gray-700 text-gray-400 hover:border-red-500 hover:text-red-400 transition-colors"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {viewerRole === "manager" && m.id === viewerId && m.canViewPassword && (
                          <button
                            onClick={() => resetPassword(m)}
                            disabled={resetLoading === m.id}
                            className="rounded px-2 py-1 text-xs border border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-400 disabled:opacity-50 transition-colors"
                          >
                            {resetLoading === m.id ? "Resetting…" : "🔑 Reset Password"}
                          </button>
                        )}
                        {viewerRole === "support" && <span className="text-xs text-gray-600">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
