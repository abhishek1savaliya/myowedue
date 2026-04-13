"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";

const initial = { name: "", email: "", phone: "" };

export default function PeoplePage() {
  const [form, setForm] = useState(initial);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPersonId, setEditingPersonId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

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
    const res = await fetch(`/api/person/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setPeople((prev) => prev.filter((person) => person._id !== id));
      setDeleteTarget(null);
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

  function shareOnWhatsApp(person) {
    const dueDirection = person.dueDirection || "settled";
    const remaining = Number(person.dueAmount || 0).toFixed(2);
    const invoiceUrl = `${window.location.origin}/api/export/person/${person._id}/invoice?scope=all`;

    let message = "";
    if (dueDirection === "you_owe_person") {
      message = `Hi ${person.name}, this amount ${remaining} is remaining from my end to you. I will pay you ASAP. Full invoice PDF: ${invoiceUrl}`;
    } else if (dueDirection === "person_owes_you") {
      message = `Hi ${person.name}, please send me remaining amount ${remaining} ASAP. Full invoice PDF: ${invoiceUrl}`;
    } else {
      message = `Hi ${person.name}, no remaining balance at the moment. Sharing full invoice PDF for reference: ${invoiceUrl}`;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">People</h1>
        <p className="text-sm text-zinc-600">Manage contacts and view give vs received-back balance.</p>
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
              {p.email ? <p className="mt-1 text-sm text-zinc-600">{p.email}</p> : null}
              {p.phone ? <p className="text-sm text-zinc-600">{p.phone}</p> : null}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-zinc-100 p-2">
                  <p className="text-zinc-500">Total Given</p>
                  <p className="font-semibold text-black">{Number(p.pendingCredit || 0).toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-zinc-100 p-2">
                  <p className="text-zinc-500">Total Received Back</p>
                  <p className="font-semibold text-black">{Number(p.pendingDebit || 0).toFixed(2)}</p>
                </div>
                <div className="col-span-2 rounded-lg bg-zinc-100 p-2">
                  <p className="text-zinc-500">Current Due</p>
                  <p className="font-semibold text-black">{Number(p.dueAmount || 0).toFixed(2)}</p>
                  <p className="mt-1 text-zinc-600">
                    {p.dueDirection === "person_owes_you"
                      ? `${p.name} owes you`
                      : p.dueDirection === "you_owe_person"
                        ? `You owe ${p.name}`
                        : "No due"}
                  </p>
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
                  href={`/api/export/person/${p._id}/invoice?scope=all`}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-xs sm:w-auto"
                >
                  Full Invoice
                </a>
                <button
                  type="button"
                  onClick={() => shareOnWhatsApp(p)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-xs sm:w-auto"
                >
                  Share on WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget({ id: p._id, name: p.name })}
                  className="w-full rounded-lg border border-black px-3 py-2 text-center text-xs sm:w-auto"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-black">Delete Person?</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Move {deleteTarget.name} and related transactions to bin?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removePerson(deleteTarget.id)}
                className="rounded-lg bg-black px-4 py-2 text-sm text-white"
              >
                Yes, Move to Bin
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
