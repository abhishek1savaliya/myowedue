"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";

const initial = { name: "", email: "", phone: "" };

export default function PeoplePage() {
  const [form, setForm] = useState(initial);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPersonId, setEditingPersonId] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/person", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setPeople(data.people || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addPerson(e) {
    e.preventDefault();
    const res = await fetch("/api/person", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm(initial);
      load();
    }
  }

  async function removePerson(id) {
    const yes = window.confirm("Move this person and related transactions to bin?");
    if (!yes) return;

    const res = await fetch(`/api/person/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setPeople((prev) => prev.filter((person) => person._id !== id));
      await load();
    } else {
      window.alert(data.message || "Failed to delete person");
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingPersonId) return;

    const res = await fetch(`/api/person/${editingPersonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setEditingPersonId("");
      setForm(initial);
      load();
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">People</h1>
        <p className="text-sm text-zinc-600">Manage contacts and see per-person credit/debit totals.</p>
      </header>

      <form onSubmit={editingPersonId ? saveEdit : addPerson} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-4">
        <input
          required
          value={form.name}
          onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
          placeholder="Name"
          className="rounded-xl border border-zinc-300 px-3 py-2"
        />
        <input
          value={form.email}
          onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
          placeholder="Email"
          className="rounded-xl border border-zinc-300 px-3 py-2"
        />
        <input
          value={form.phone}
          onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))}
          placeholder="Phone (optional)"
          className="rounded-xl border border-zinc-300 px-3 py-2"
        />
        <button className="rounded-xl bg-black px-3 py-2 text-white md:col-span-2 xl:col-span-1">
          {editingPersonId ? "Save Person" : "Add Person"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-zinc-600">Loading people...</p>
      ) : people.length === 0 ? (
        <EmptyState text="No people added yet." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {people.map((p) => (
            <article key={p._id} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <h3 className="text-lg font-semibold text-black">{p.name}</h3>
              <p className="mt-1 text-sm text-zinc-600">{p.email || "No email"}</p>
              <p className="text-sm text-zinc-600">{p.phone || "No phone"}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-zinc-100 p-2">
                  <p className="text-zinc-500">Credit</p>
                  <p className="font-semibold text-black">{p.totalCredit || 0}</p>
                </div>
                <div className="rounded-lg bg-zinc-100 p-2">
                  <p className="text-zinc-500">Debit</p>
                  <p className="font-semibold text-black">{p.totalDebit || 0}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingPersonId(p._id);
                    setForm({
                      name: p.name || "",
                      email: p.email || "",
                      phone: p.phone || "",
                    });
                  }}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-xs sm:w-auto"
                >
                  Edit
                </button>
                <a
                  href={`/api/export/person/${p._id}/invoice?scope=credit`}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-xs sm:w-auto"
                >
                  Credit Invoice
                </a>
                <a
                  href={`/api/export/person/${p._id}/invoice?scope=debit`}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-xs sm:w-auto"
                >
                  Debit Invoice
                </a>
                <a
                  href={`/api/export/person/${p._id}/invoice?scope=pending`}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-xs sm:w-auto"
                >
                  Pending Invoice
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Hi ${p.name}, please settle your pending amount.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-xs sm:w-auto"
                >
                  Share on WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => removePerson(p._id)}
                  className="w-full rounded-lg border border-black px-3 py-2 text-center text-xs sm:w-auto"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
