"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";

export default function BinPage() {
  const [personBin, setPersonBin] = useState([]);
  const [transactionBin, setTransactionBin] = useState([]);
  const [eventBin, setEventBin] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [pRes, tRes, eRes] = await Promise.all([
      fetch("/api/bin/person", { cache: "no-store" }),
      fetch("/api/bin/transaction", { cache: "no-store" }),
      fetch("/api/bin/event", { cache: "no-store" }),
    ]);

    const [pData, tData, eData] = await Promise.all([pRes.json(), tRes.json(), eRes.json()]);
    if (pRes.ok) setPersonBin(pData.people || []);
    if (tRes.ok) setTransactionBin(tData.transactions || []);
    if (eRes.ok) setEventBin(eData.events || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function restorePerson(id) {
    const res = await fetch(`/api/bin/person/${id}/restore`, { method: "POST" });
    if (res.ok) load();
  }

  async function restoreTransaction(id) {
    const res = await fetch(`/api/bin/transaction/${id}/restore`, { method: "POST" });
    if (res.ok) load();
  }

  async function restoreEvent(id) {
    const res = await fetch(`/api/bin/event/${id}/restore`, { method: "POST" });
    if (res.ok) load();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Bin</h1>
        <p className="text-sm text-zinc-600">Restore deleted people/transactions/events within 3 years. After that they are auto-removed.</p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Person Bin</h2>
        <p className="text-xs text-zinc-500">Deleting a person moves the person and all linked transactions here.</p>
        <div className="mt-4 space-y-3">
          {loading ? (
            <Loader />
          ) : personBin.length === 0 ? (
            <EmptyState text="Person bin is empty." />
          ) : (
            personBin.map((p) => (
              <article key={p._id} className="rounded-xl border border-zinc-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-black">{p.name}</p>
                    <p className="text-xs text-zinc-500">Deleted transactions: {p.deletedTransactions}</p>
                  </div>
                  <button onClick={() => restorePerson(p._id)} className="w-full rounded-lg border border-black px-3 py-2 text-xs sm:w-auto">
                    Restore
                  </button>
                </div>
                <p className="mt-1 text-xs text-zinc-500">Restore before: {p.restoreUntil ? new Date(p.restoreUntil).toLocaleDateString() : "N/A"}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Transaction Bin</h2>
        <p className="text-xs text-zinc-500">Only individually deleted transactions appear here.</p>
        <div className="mt-4 space-y-3">
          {loading ? (
            <Loader />
          ) : transactionBin.length === 0 ? (
            <EmptyState text="Transaction bin is empty." />
          ) : (
            transactionBin.map((t) => (
              <article key={t._id} className="rounded-xl border border-zinc-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-black">{t.personId?.name || "Unknown"}</p>
                    <p className="text-xs text-zinc-500">{t.type.toUpperCase()} • {t.amount} {t.currency} • {new Date(t.date).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => restoreTransaction(t._id)} className="w-full rounded-lg border border-black px-3 py-2 text-xs sm:w-auto">
                    Restore
                  </button>
                </div>
                <p className="mt-1 text-xs text-zinc-500">Restore before: {t.restoreUntil ? new Date(t.restoreUntil).toLocaleDateString() : "N/A"}</p>
                <details className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                  <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                    Transaction History
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    {t.changeLogs?.length ? (
                      [...t.changeLogs]
                        .sort((a, b) => new Date(b.at) - new Date(a.at))
                        .map((log, idx) => (
                          <div key={`${t._id}-bin-log-${idx}`} className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-700">
                            <p>{log.message}</p>
                            <p className="text-[10px] text-zinc-500">{new Date(log.at).toLocaleString()}</p>
                          </div>
                        ))
                    ) : (
                      <p className="text-[11px] text-zinc-500">No change history yet.</p>
                    )}
                  </div>
                </details>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Event Bin</h2>
        <p className="text-xs text-zinc-500">Deleted events can be restored within 3 years.</p>
        <div className="mt-4 space-y-3">
          {loading ? (
            <Loader />
          ) : eventBin.length === 0 ? (
            <EmptyState text="Event bin is empty." />
          ) : (
            eventBin.map((e) => (
              <article key={e._id} className="rounded-xl border border-zinc-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-black">{e.title}</p>
                    <p className="text-xs text-zinc-500">
                      {new Date(e.startTime).toLocaleString(undefined, {
                        weekday: "short", month: "short", day: "numeric", year: "numeric",
                        ...(e.allDay ? {} : { hour: "2-digit", minute: "2-digit" }),
                      })}
                      {e.location ? ` • ${e.location}` : ""}
                    </p>
                    {e.description && <p className="mt-0.5 text-xs text-zinc-400 line-clamp-1">{e.description}</p>}
                  </div>
                  <button onClick={() => restoreEvent(e._id)} className="w-full rounded-lg border border-black px-3 py-2 text-xs sm:w-auto">
                    Restore
                  </button>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Deleted: {e.deletedAt ? new Date(e.deletedAt).toLocaleDateString() : "N/A"} •{" "}
                  Restore before: {e.restoreUntil ? new Date(e.restoreUntil).toLocaleDateString() : "N/A"}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
