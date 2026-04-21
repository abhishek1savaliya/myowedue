"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const initialForm = {
  plan: "pro_monthly",
  durationDays: "30",
  maxRedemptions: "1",
  code: "",
  notes: "",
  expiresAt: "",
};

export default function AdminVouchersPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [meRes, vouchersRes] = await Promise.all([
      fetch("/api/admin/me"),
      fetch("/api/admin/vouchers"),
    ]);

    if (meRes.status === 401 || vouchersRes.status === 401) {
      router.push("/admin/login");
      return;
    }

    const meData = await meRes.json().catch(() => null);
    const vouchersData = await vouchersRes.json().catch(() => ({}));
    setAdmin(meData);
    setVouchers(vouchersData.vouchers || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/vouchers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setMessage(data.message || "Failed to create voucher.");
      return;
    }

    setForm(initialForm);
    setMessage(`Voucher ${data.voucher.code} created.`);
    load();
  }

  async function toggleVoucher(voucher) {
    const res = await fetch(`/api/admin/vouchers/${voucher.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !voucher.isActive }),
    });
    if (res.ok) load();
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-slate-400">Loading vouchers...</div>;
  }

  if (!admin || !["superadmin", "manager"].includes(admin.role)) {
    return <div className="p-6 text-sm text-slate-400">You do not have access to voucher management.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Subscription Vouchers</h1>
        <p className="mt-1 text-sm text-slate-400">Super admin and manager can generate voucher codes for users to apply during subscription purchase.</p>
      </div>

      <form onSubmit={handleCreate} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold text-white">Create Voucher</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="text-sm text-slate-300">
            <span className="mb-1 block">Plan</span>
            <input
              value="Pro Monthly"
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-400"
            />
          </label>
          <label className="text-sm text-slate-300">
            <span className="mb-1 block">Duration Days</span>
            <input value={form.durationDays} onChange={(e) => setForm((prev) => ({ ...prev, durationDays: e.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          </label>
          <label className="text-sm text-slate-300">
            <span className="mb-1 block">Max Redemptions</span>
            <input value={form.maxRedemptions} onChange={(e) => setForm((prev) => ({ ...prev, maxRedemptions: e.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          </label>
          <label className="text-sm text-slate-300">
            <span className="mb-1 block">Custom Code (optional)</span>
            <input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="Auto-generated if empty" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          </label>
          <label className="text-sm text-slate-300">
            <span className="mb-1 block">Expiry Date (optional)</span>
            <input type="date" value={form.expiresAt} onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          </label>
          <label className="text-sm text-slate-300 md:col-span-3">
            <span className="mb-1 block">Notes</span>
            <textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} rows={3} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button type="submit" disabled={saving} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60">
            {saving ? "Creating..." : "Generate Voucher"}
          </button>
          {message ? <p className="text-sm text-slate-400">{message}</p> : null}
        </div>
      </form>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold text-white">Generated Vouchers</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-400">
                <th className="pb-2 pr-4">Code</th>
                <th className="pb-2 pr-4">Plan</th>
                <th className="pb-2 pr-4">Usage</th>
                <th className="pb-2 pr-4">Expires</th>
                <th className="pb-2 pr-4">Created By</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((voucher) => (
                <tr key={voucher.id} className="border-b border-slate-800/60 text-slate-200">
                  <td className="py-3 pr-4 font-mono text-amber-300">{voucher.code}</td>
                  <td className="py-3 pr-4">Pro Monthly</td>
                  <td className="py-3 pr-4">{voucher.redemptionCount}/{voucher.maxRedemptions}</td>
                  <td className="py-3 pr-4">{voucher.expiresAt ? new Date(voucher.expiresAt).toLocaleDateString() : "No expiry"}</td>
                  <td className="py-3 pr-4">{voucher.generatedByAdminName || "Admin"}</td>
                  <td className="py-3 pr-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${voucher.isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-400"}`}>
                      {voucher.isActive ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="py-3">
                    <button onClick={() => toggleVoucher(voucher)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-amber-500/40 hover:text-amber-300">
                      {voucher.isActive ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
