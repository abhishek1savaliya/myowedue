"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Gem, Link2, Lock, Pencil, Repeat, Trash2 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import ModalPortal from "@/components/ModalPortal";
import { formatDateOnly } from "@/lib/datetime";
import { recurringLabel } from "@/lib/recurring";

const txInitial = {
  personId: "",
  amount: "",
  type: "credit",
  currency: "USD",
  notes: "",
  date: formatDateOnly(new Date()),
  recurringEnabled: false,
  recurringFrequency: "monthly",
  recurringInterval: "1",
  recurringEndDate: "",
};

export default function TransactionsPage() {
  const [people, setPeople] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState(txInitial);
  const [query, setQuery] = useState({ q: "", view: "", start: "", end: "" });
  const [editingId, setEditingId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [exportModal, setExportModal] = useState(null);
  const [user, setUser] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [paymentLinks, setPaymentLinks] = useState({});
  const [linkVisibility, setLinkVisibility] = useState({});
  const [origin, setOrigin] = useState("");

  async function loadPeople() {
    const res = await fetch("/api/person", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setPeople(data.people || []);
  }

  async function loadUser() {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setUser(data.user || null);
  }

  async function loadTransactions(forceFresh = false, overrideQuery) {
    const q = overrideQuery ?? query;
    const params = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    if (forceFresh) {
      params.set("_r", String(Date.now()));
    }
    const res = await fetch(`/api/transaction?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setTransactions(data.transactions || []);
  }

  useEffect(() => {
    loadPeople();
    loadUser();
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    loadTransactions(true, query);
  }, [query]);

  async function saveTransaction(e) {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/transaction/${editingId}` : "/api/transaction";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setForm(txInitial);
        setEditingId("");
        setFeedback(editingId ? "Transaction updated." : "Transaction created.");
        await loadTransactions(true);
      } else {
        setFeedback(data.message || "Failed to save transaction.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function removeTx(id) {
    const res = await fetch(`/api/transaction/${id}`, { method: "DELETE" });
    if (res.ok) loadTransactions(true);
  }

  function openExportModal() {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    setExportModal({
      startDate: formatDateOnly(startDate),
      endDate: formatDateOnly(endDate),
    });
  }

  function exportPDF() {
    if (!exportModal) return;
    const params = new URLSearchParams({ format: "pdf" });
    if (exportModal.startDate) params.set("start", exportModal.startDate);
    if (exportModal.endDate) params.set("end", exportModal.endDate);
    window.open(`/api/export?${params}`, '_blank');
    setExportModal(null);
  }

  function getPaymentLinkUrl(transaction) {
    if (paymentLinks[transaction._id]) return paymentLinks[transaction._id];
    if (transaction.paymentLinkToken && origin) return `${origin}/pay/${transaction.paymentLinkToken}`;
    return "";
  }

  async function copyPaymentLink(linkUrl) {
    if (!linkUrl) return;
    setFeedback("");
    if (typeof window !== "undefined" && window.navigator?.clipboard?.writeText) {
      await window.navigator.clipboard.writeText(linkUrl);
      setFeedback("Payment link copied to clipboard.");
    } else {
      setFeedback("Payment link is ready to copy.");
    }
  }

  async function generatePaymentLink(transactionId, visibility = "public") {
    setFeedback("");
    const res = await fetch(`/api/transaction/${transactionId}/payment-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFeedback(data.message || "Failed to generate payment link.");
      return;
    }

    setPaymentLinks((prev) => ({ ...prev, [transactionId]: data.paymentLinkUrl }));
    setLinkVisibility((prev) => ({ ...prev, [transactionId]: data.paymentLinkVisibility || visibility }));
    if (typeof window !== "undefined" && window.navigator?.clipboard?.writeText) {
      await window.navigator.clipboard.writeText(data.paymentLinkUrl);
      setFeedback(`Payment link copied (${(data.paymentLinkVisibility || visibility).toUpperCase()}).`);
    } else {
      setFeedback("Payment link ready.");
    }
  }

  const transactionCount = useMemo(
    () => transactions.length,
    [transactions]
  );
  const isPremium = Boolean(user?.isPremium);

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

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${isPremium ? "border border-amber-300 bg-amber-50 text-amber-700" : "border border-zinc-300 bg-zinc-50 text-zinc-600"}`}>
            {isPremium ? <Gem className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {isPremium ? user?.subscriptionLabel || "Pro" : "Free Plan"}
          </span>
          <p className="text-sm text-zinc-600">
            {isPremium
              ? "Recurring dues and payment-link generation are active on your account."
              : "Upgrade to Pro to unlock recurring dues and shareable payment links."}
          </p>
        </div>
      </div>

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
        <label className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${isPremium ? "border-zinc-300 text-zinc-700" : "border-zinc-200 bg-zinc-50 text-zinc-400"}`}>
          <input
            type="checkbox"
            checked={form.recurringEnabled}
            disabled={!isPremium}
            onChange={(e) => setForm((v) => ({ ...v, recurringEnabled: e.target.checked }))}
          />
          Recurring due
        </label>
        <select
          value={form.recurringFrequency}
          disabled={!isPremium || !form.recurringEnabled}
          onChange={(e) => setForm((v) => ({ ...v, recurringFrequency: e.target.value }))}
          className="rounded-xl border border-zinc-300 px-3 py-2 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
        >
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
        <input
          type="number"
          min="1"
          placeholder="Interval"
          value={form.recurringInterval}
          disabled={!isPremium || !form.recurringEnabled}
          onChange={(e) => setForm((v) => ({ ...v, recurringInterval: e.target.value }))}
          className="rounded-xl border border-zinc-300 px-3 py-2 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
        />
        <input
          type="date"
          value={form.recurringEndDate}
          disabled={!isPremium || !form.recurringEnabled}
          onChange={(e) => setForm((v) => ({ ...v, recurringEndDate: e.target.value }))}
          className="rounded-xl border border-zinc-300 px-3 py-2 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
        />
        <button
          disabled={isSaving}
          className="rounded-xl bg-black px-3 py-2 text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-70 md:col-span-2 xl:col-span-6"
        >
          <span className="inline-flex items-center gap-2">
            {isSaving ? (
              <span className="premium-spinner-core inline-block h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {isSaving
              ? editingId
                ? "Updating transaction..."
                : "Adding transaction..."
              : editingId
                ? "Update Transaction"
                : "Add Transaction"}
          </span>
        </button>
        {feedback ? <p className="text-sm text-zinc-600 md:col-span-2 xl:col-span-6">{feedback}</p> : null}
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
          <option value="">All Types</option>
          <option value="credit">I Gave</option>
          <option value="debit">Received Back</option>
        </select>
        <input type="date" value={query.start} onChange={(e) => setQuery((v) => ({ ...v, start: e.target.value }))} className="rounded-xl border border-zinc-300 px-3 py-2" />
        <input type="date" value={query.end} onChange={(e) => setQuery((v) => ({ ...v, end: e.target.value }))} className="rounded-xl border border-zinc-300 px-3 py-2" />
        <button type="button" onClick={() => loadTransactions(true)} className="rounded-xl border border-black px-3 py-2 text-sm md:col-span-2 xl:col-span-1">Apply</button>
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-600\">Total transactions: {transactionCount}</p>
        <button
          onClick={openExportModal}
          className="flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
          title="Export to PDF"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1 4.5 4.5 0 1-3.364 6.78M9 13h.01M9 16H8a2 2 0 01-2-2v-6a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2h-1M4 5h16" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
          Export PDF
        </button>
      </div>

      {exportModal && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold text-black mb-4">Export Transactions to PDF</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={exportModal.startDate}
                  onChange={(e) => setExportModal(v => ({ ...v, startDate: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={exportModal.endDate}
                  onChange={(e) => setExportModal(v => ({ ...v, endDate: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setExportModal(null)}
                  className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  onClick={exportPDF}
                  className="flex-1 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Generate PDF
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

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
                <span className="text-sm text-zinc-600">{formatDateOnly(t.date)}</span>
                {t.recurringEnabled ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    <Repeat className="h-3 w-3" />
                    {recurringLabel(t)}
                  </span>
                ) : null}
              </div>
              {t.notes ? <p className="mt-1 text-sm text-zinc-500">{t.notes}</p> : null}
              {getPaymentLinkUrl(t) ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="break-all text-xs text-zinc-500">
                    Payment link: {getPaymentLinkUrl(t)}
                  </p>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                    (linkVisibility[t._id] || t.paymentLinkVisibility || "public") === "private"
                      ? "border-zinc-400 bg-zinc-100 text-zinc-600"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}>
                    {(linkVisibility[t._id] || t.paymentLinkVisibility || "public") === "private" ? (
                      <><Lock className="h-2.5 w-2.5" /> Private</>
                    ) : (
                      <>&#x1F30D; Public</>
                    )}
                  </span>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(t._id);
                    setForm({
                      personId: t.personId?._id || "",
                      amount: t.amount,
                      type: t.type,
                      currency: t.currency,
                      notes: t.notes || "",
                      date: formatDateOnly(t.date),
                      recurringEnabled: Boolean(t.recurringEnabled),
                      recurringFrequency: t.recurringFrequency || "monthly",
                      recurringInterval: String(t.recurringInterval || 1),
                      recurringEndDate: t.recurringEndDate ? formatDateOnly(t.recurringEndDate) : "",
                    });
                  }}
                  aria-label="Edit transaction"
                  title="Edit transaction"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 transition hover:border-black hover:text-black"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeTx(t._id)}
                  aria-label="Delete transaction"
                  title="Delete transaction"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-black text-black transition hover:bg-black hover:text-white"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => fetch("/api/reminder", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ personId: t.personId?._id }),
                  })}
                  aria-label="Send reminder"
                  title="Send reminder"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 transition hover:border-black hover:text-black"
                >
                  <BellRing className="h-4 w-4" />
                </button>
                {isPremium ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const existingLink = getPaymentLinkUrl(t);
                        if (existingLink) {
                          copyPaymentLink(existingLink);
                          return;
                        }
                        generatePaymentLink(t._id, "public");
                      }}
                      aria-label={t.paymentLinkToken || paymentLinks[t._id] ? "Copy payment link" : "Generate public link"}
                      title={t.paymentLinkToken || paymentLinks[t._id] ? "Copy payment link" : "Generate public link"}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-amber-300 bg-amber-50 text-amber-700 transition hover:border-amber-400 hover:bg-amber-100"
                    >
                      <Link2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        generatePaymentLink(
                          t._id,
                          (linkVisibility[t._id] || t.paymentLinkVisibility || "public") === "private"
                            ? "public"
                            : "private"
                        )
                      }
                      aria-label="Toggle link visibility"
                      title={(linkVisibility[t._id] || t.paymentLinkVisibility || "public") === "private" ? "Set link public" : "Set link private"}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-zinc-50 text-zinc-600 transition hover:border-zinc-500 hover:bg-zinc-100"
                    >
                      <Lock className="h-4 w-4" />
                    </button>
                    <span
                      className={`inline-flex h-10 items-center rounded-lg border px-3 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                        (linkVisibility[t._id] || t.paymentLinkVisibility || "public") === "private"
                          ? "border-zinc-400 bg-zinc-100 text-zinc-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {(linkVisibility[t._id] || t.paymentLinkVisibility || "public")}
                    </span>
                  </>
                ) : null}
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
