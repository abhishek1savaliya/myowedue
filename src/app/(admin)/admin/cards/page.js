"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminCardsPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState(null);
  const [textareaValue, setTextareaValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [meta, setMeta] = useState({ updatedByAdminName: "", updatedAt: "" });

  async function load() {
    const [meRes, catalogRes] = await Promise.all([
      fetch("/api/admin/me"),
      fetch("/api/admin/cards/catalog"),
    ]);

    if (meRes.status === 401 || catalogRes.status === 401) {
      router.push("/admin/login");
      return;
    }

    const meData = await meRes.json().catch(() => null);
    const catalogData = await catalogRes.json().catch(() => ({}));
    setAdmin(meData);

    if (catalogRes.ok) {
      setTextareaValue(JSON.stringify(catalogData.catalog || {}, null, 2));
      setMeta({
        updatedByAdminName: catalogData.updatedByAdminName || "",
        updatedAt: catalogData.updatedAt || "",
      });
    } else {
      setMessage(catalogData.message || "Failed to load card catalog.");
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    let parsed;
    try {
      parsed = JSON.parse(textareaValue);
    } catch {
      setSaving(false);
      setMessage("JSON is invalid. Please fix it before saving.");
      return;
    }

    const res = await fetch("/api/admin/cards/catalog", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalog: parsed }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setMessage(data.message || "Failed to save card catalog.");
      return;
    }

    setTextareaValue(JSON.stringify(data.catalog || {}, null, 2));
    setMeta({
      updatedByAdminName: data.updatedByAdminName || "",
      updatedAt: data.updatedAt || "",
    });
    setMessage(data.message || "Card catalog updated successfully.");
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-slate-400">Loading card catalog...</div>;
  }

  if (!admin || !["superadmin", "manager"].includes(admin.role)) {
    return <div className="p-6 text-sm text-slate-400">You do not have access to card catalog management.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Card Catalog</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage card types, issuing countries, issuing banks, and bank-wise variants in JSON. User forms will update automatically.
        </p>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Catalog JSON</h2>
            <p className="mt-1 text-sm text-slate-400">
              Each bank should include a `countryCode`, optional `cardTypes`, and a `variants` array with `label`, `value`, and `network`.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              You can also paste a raw <code className="rounded bg-slate-800 px-1 py-0.5 text-xs text-slate-200">{'{"banks": [...]}'}</code> file.
              Card types and country lists will be derived automatically.
            </p>
          </div>
          {meta.updatedAt ? (
            <p className="text-xs text-slate-500">
              Last updated by {meta.updatedByAdminName || "Admin"} on {new Date(meta.updatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <textarea
            value={textareaValue}
            onChange={(e) => setTextareaValue(e.target.value)}
            rows={28}
            spellCheck={false}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm text-slate-100"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Catalog"}
            </button>
            {message ? <p className="text-sm text-slate-400">{message}</p> : null}
          </div>
        </form>
      </section>
    </div>
  );
}
