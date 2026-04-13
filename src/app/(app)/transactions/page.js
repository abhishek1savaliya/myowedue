"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";

const txInitial = {
  personId: "",
  amount: "",
  type: "credit",
  currency: "USD",
  notes: "",
  date: new Date().toISOString().slice(0, 10),
};

export default function TransactionsPage() {
  const [people, setPeople] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState(txInitial);
  const [query, setQuery] = useState({ q: "", view: "", start: "", end: "" });
  const [editingId, setEditingId] = useState("");

  async function loadPeople() {
    const res = await fetch("/api/person", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setPeople(data.people || []);
  }

  async function loadTransactions() {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const res = await fetch(`/api/transaction?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setTransactions(data.transactions || []);
  }

  useEffect(() => {
    loadPeople();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [query]);

  async function saveTransaction(e) {
    e.preventDefault();
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/transaction/${editingId}` : "/api/transaction";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setForm(txInitial);
      setEditingId("");
      loadTransactions();
    }
  }

  async function removeTx(id) {
    const res = await fetch(`/api/transaction/${id}`, { method: "DELETE" });
    if (res.ok) loadTransactions();
  }

  const pendingCount = useMemo(
    () => transactions.filter((t) => t.status === "pending").length,
    [transactions]
  );

  function getEntryStyle(tx) {
    if (tx.type === "credit") {
      return {
        amountClass: "text-rose-700 bg-rose-50 border-rose-200",
        labelClass: "text-rose-700 bg-rose-50 border-rose-200",
        amountText: `-${Number(tx.amount).toFixed(2)} ${tx.currency}`,
        label: "YOU GAVE",
      };
    }

    return {
      amountClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
      labelClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
      amountText: `+${Number(tx.amount).toFixed(2)} ${tx.currency}`,
      label: "YOU RECEIVED BACK",
    };
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-zinc-600">Track money you gave and received back.</p>
      </header>

      <form onSubmit={saveTransaction} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-6">
        <select
          required
          value={form.personId}
          onChange={(e) => setForm((v) => ({ ...v, personId: e.target.value }))}
          className="rounded-xl border border-zinc-300 px-3 py-2"
        >
          <option value="">Select person</option>
          {people.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>
        <input
          required
          type="number"
          step="0.01"
          placeholder="Amount"
          value={form.amount}
          onChange={(e) => setForm((v) => ({ ...v, amount: e.target.value }))}
          className="rounded-xl border border-zinc-300 px-3 py-2"
        />
        <select
          value={form.type}
          onChange={(e) => setForm((v) => ({ ...v, type: e.target.value }))}
          className="rounded-xl border border-zinc-300 px-3 py-2"
        >
          <option value="credit">I GAVE MONEY</option>
          <option value="debit">I RECEIVED BACK</option>
        </select>
        <select
          value={form.currency}
          onChange={(e) => setForm((v) => ({ ...v, currency: e.target.value }))}
          className="rounded-xl border border-zinc-300 px-3 py-2"
        >
          <option>USD</option>
          <option>AUD</option>
          <option>INR</option>
          <option>EUR</option>
          <option>GBP</option>
        </select>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm((v) => ({ ...v, date: e.target.value }))}
          className="rounded-xl border border-zinc-300 px-3 py-2"
        />
        <input
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))}
          className="rounded-xl border border-zinc-300 px-3 py-2"
        />
        <button className="rounded-xl bg-black px-3 py-2 text-sm text-white md:col-span-2 xl:col-span-6">
          {editingId ? "Update Transaction" : "Add Transaction"}
        </button>
      </form>

      <section className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-5">
        <input
          placeholder="Search by person"
          value={query.q}
          onChange={(e) => setQuery((v) => ({ ...v, q: e.target.value }))}
          className="rounded-xl border border-zinc-300 px-3 py-2"
        />
        <select
          value={query.view}
          onChange={(e) => setQuery((v) => ({ ...v, view: e.target.value }))}
          className="rounded-xl border border-zinc-300 px-3 py-2"
        >
          <option value="">All</option>
          <option value="credit_pending">I Gave</option>
          <option value="debit_pending">Received Back</option>
        </select>
        <input type="date" value={query.start} onChange={(e) => setQuery((v) => ({ ...v, start: e.target.value }))} className="rounded-xl border border-zinc-300 px-3 py-2" />
        <input type="date" value={query.end} onChange={(e) => setQuery((v) => ({ ...v, end: e.target.value }))} className="rounded-xl border border-zinc-300 px-3 py-2" />
        <button type="button" onClick={loadTransactions} className="rounded-xl border border-black px-3 py-2 text-sm md:col-span-2 xl:col-span-1">Apply</button>
      </section>

      <p className="text-sm text-zinc-600">Pending dues: {pendingCount}</p>

      {transactions.length === 0 ? (
        <EmptyState text="No transactions found." />
      ) : (
        <div className="space-y-3">
          {transactions.map((t) => (
            <article key={t._id} className="rounded-2xl border border-zinc-200 bg-white p-4">
              {(() => {
                const style = getEntryStyle(t);
                return (
                  <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-black">{t.personId?.name || "Unknown"}</h3>
                <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${style.amountClass}`}>
                  {style.amountText}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${style.labelClass}`}>
                  {style.label}
                </span>
                <span className="text-sm text-zinc-600">{new Date(t.date).toLocaleDateString()}</span>
              </div>
              {t.notes ? <p className="mt-1 text-sm text-zinc-500">{t.notes}</p> : null}

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => {
                    setEditingId(t._id);
                    setForm({
                      personId: t.personId?._id || "",
                      amount: t.amount,
                      type: t.type,
                      currency: t.currency,
                      notes: t.notes || "",
                      date: new Date(t.date).toISOString().slice(0, 10),
                    });
                  }}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 sm:w-auto"
                >
                  Edit
                </button>
                <button onClick={() => removeTx(t._id)} className="w-full rounded-lg border border-black px-3 py-2 sm:w-auto">
                  Delete
                </button>
                <button
                  onClick={() => fetch("/api/reminder", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ personId: t.personId?._id }),
                  })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 sm:w-auto"
                >
                  Send Reminder
                </button>
              </div>

              <details className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
                  Transaction History
                </summary>
                <div className="mt-2 space-y-2">
                  {t.changeLogs?.length ? (
                    [...t.changeLogs]
                      .sort((a, b) => new Date(b.at) - new Date(a.at))
                      .map((log, idx) => (
                        <div key={`${t._id}-log-${log.action || "event"}-${new Date(log.at).getTime()}-${idx}`} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700">
                          <p>{log.message}</p>
                          <p className="mt-0.5 text-[11px] text-zinc-500">{new Date(log.at).toLocaleString()}</p>
                        </div>
                      ))
                  ) : (
                    <p className="text-xs text-zinc-500">No change history yet.</p>
                  )}
                </div>
              </details>
                  </>
                );
              })()}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
