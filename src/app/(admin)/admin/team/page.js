"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ROLES = ["support", "manager", "superadmin"];

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
  const router = useRouter();
  const [team, setTeam] = useState([]);
  const [managers, setManagers] = useState([]);
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

  async function loadTeam() {
    const res = await fetch("/api/admin/team");
    if (res.status === 401) { router.push("/admin/login"); return; }
    const json = await res.json();
    setTeam(json.team || []);
    setManagers(json.managers || []);

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
    await fetch(`/api/admin/team/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !member.isActive }),
    });
    loadTeam();
  }

  async function deleteMember(id) {
    if (!confirm("Delete this team member? This cannot be undone.")) return;
    await fetch(`/api/admin/team/${id}`, { method: "DELETE" });
    loadTeam();
  }

  async function resetPassword(member) {
    if (!confirm(`Reset password for ${member.name}? A new password will be generated.`)) return;
    setCreds(null);
    setResetLoading(member.id);
    try {
      const res = await fetch(`/api/admin/team/${member.id}/reset-password`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        alert(json.message || "Failed to reset password.");
        return;
      }
      const newPassword = json?.newPassword || json?.data?.newPassword || "";
      if (!newPassword) {
        alert("Password reset succeeded, but password value was not returned.");
        return;
      }
      // Show password inline in the row immediately.
      setRowPasswords((prev) => ({ ...prev, [member.id]: newPassword }));
      setRowPasswordVisible((prev) => ({ ...prev, [member.id]: true }));
    } catch {
      alert("Network error — could not reset password.");
    } finally {
      setResetLoading(null);
    }
  }

  async function handleEyeToggle(member) {
    if (member.role === "superadmin") return;

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
        alert(json.message || "Unable to generate password.");
        return;
      }
      const newPassword = json?.newPassword || json?.data?.newPassword || "";
      if (!newPassword) {
        alert("Password generated but not returned by server.");
        return;
      }

      setRowPasswords((prev) => ({ ...prev, [member.id]: newPassword }));
      setRowPasswordVisible((prev) => ({ ...prev, [member.id]: true }));
    } catch {
      alert("Network error while generating password.");
    } finally {
      setEyeLoading((prev) => ({ ...prev, [member.id]: false }));
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage support employees</p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setCreds(null); setFormError(""); }}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-amber-400 transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Employee"}
        </button>
      </div>

      {/* Credentials display (create or reset) */}
      {creds && (
        <CredsBox creds={creds} onDismiss={() => setCreds(null)} />
      )}

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
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value, managerId: e.target.value === "support" ? form.managerId : "" })}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
            {form.role === "support" && (
              <div>
                <label className="mb-1 block text-sm text-gray-400">Assign Manager</label>
                <select
                  value={form.managerId}
                  onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="px-4 pb-3 pt-4 font-medium">Employee</th>
                  <th className="px-4 pb-3 pt-4 font-medium">ID</th>
                  <th className="px-4 pb-3 pt-4 font-medium">Role</th>
                  <th className="px-4 pb-3 pt-4 font-medium">Manager</th>
                  <th className="px-4 pb-3 pt-4 font-medium">Status</th>
                  <th className="px-4 pb-3 pt-4 font-medium">Password</th>
                  <th className="px-4 pb-3 pt-4 font-medium">Last Login</th>
                  <th className="px-4 pb-3 pt-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id} className="border-b border-gray-800/60 hover:bg-gray-800/40">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{m.name}</div>
                      <div className="text-gray-500 text-xs">{m.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-300 text-xs">{m.employeeId}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        m.role === "superadmin"
                          ? "bg-amber-500/20 text-amber-400"
                          : m.role === "manager"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-gray-700 text-gray-300"
                      }`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {m.role === "support"
                        ? (m.managerName || "Unassigned")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        m.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                      }`}>
                        {m.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    {/* Password column — shows after reset, hidden otherwise */}
                    <td className="px-4 py-3">
                      {m.role === "superadmin" ? (
                        <span className="text-xs text-gray-600">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
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
                        <button
                          onClick={() => toggleActive(m)}
                          className="rounded px-2 py-1 text-xs border border-gray-700 text-gray-400 hover:border-amber-500 hover:text-amber-400 transition-colors"
                        >
                          {m.isActive ? "Disable" : "Enable"}
                        </button>
                        {m.role !== "superadmin" && (
                          <button
                            onClick={() => resetPassword(m)}
                            disabled={resetLoading === m.id}
                            className="rounded px-2 py-1 text-xs border border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-400 disabled:opacity-50 transition-colors"
                          >
                            {resetLoading === m.id ? "Resetting…" : "🔑 Reset Password"}
                          </button>
                        )}
                        {m.role !== "superadmin" && (
                          <button
                            onClick={() => deleteMember(m.id)}
                            className="rounded px-2 py-1 text-xs border border-gray-700 text-gray-400 hover:border-red-500 hover:text-red-400 transition-colors"
                          >
                            Delete
                          </button>
                        )}
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
