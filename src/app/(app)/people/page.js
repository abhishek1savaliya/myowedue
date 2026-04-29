"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";
import { normalizeCurrency, convertFromUSD, formatCurrency, DEFAULT_FX } from "@/lib/currency";

const initial = { name: "", email: "", phone: "" };

export default function PeoplePage() {
  const [form, setForm] = useState(initial);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPersonId, setEditingPersonId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [invoiceCurrencies, setInvoiceCurrencies] = useState({});
  const [rates, setRates] = useState(null);
  const [invoiceModal, setInvoiceModal] = useState(null); // { personId, personName, startDate, endDate }
  const invoiceOptions = ["AUD", "INR", "USD", "EUR", "GBP"];

  function getInvoiceCurrency(personId) {
    return invoiceCurrencies[personId] || "AUD";
  }

  function getRates() {
    return rates || DEFAULT_FX;
  }

  function convertAmount(amount, fromCurrency, toCurrency) {
    const currencyRates = getRates();
    if (!amount || fromCurrency === toCurrency) return Number(amount || 0);
    const amountInUsd = normalizeCurrency(Number(amount || 0), fromCurrency || "USD", currencyRates);
    return convertFromUSD(amountInUsd, toCurrency, currencyRates);
  }

  function getConvertedTotal(byCurrency, targetCurrency) {
    return Object.entries(byCurrency || {}).reduce((sum, [currency, value]) => {
      return sum + convertAmount(value, currency, targetCurrency);
    }, 0);
  }

  function getPersonTotals(person) {
    const currency = getInvoiceCurrency(person._id);
    const pendingCreditByCurrency = person.pendingCreditByCurrency || { AUD: person.pendingCredit || 0 };
    const pendingDebitByCurrency = person.pendingDebitByCurrency || { AUD: person.pendingDebit || 0 };
    const pendingCredit = getConvertedTotal(pendingCreditByCurrency, currency);
    const pendingDebit = getConvertedTotal(pendingDebitByCurrency, currency);
    const dueAmount = Math.abs(pendingDebit - pendingCredit);
    const dueDirection = pendingDebit > pendingCredit ? "you_owe_person" : pendingDebit < pendingCredit ? "person_owes_you" : "settled";
    return { currency, pendingCredit, pendingDebit, dueAmount, dueDirection };
  }

  async function load(forceFresh = false) {
    setLoading(true);
    const peopleUrl = forceFresh ? `/api/person?_r=${Date.now()}` : "/api/person";
    const [peopleRes, ratesRes] = await Promise.all([
      fetch(peopleUrl, { cache: "no-store" }),
      fetch("/api/exchange-rates", { cache: "no-store" }),
    ]);

    const peopleData = await peopleRes.json().catch(() => ({}));
    const ratesData = await ratesRes.json().catch(() => ({}));

    if (peopleRes.ok) setPeople(peopleData.people || []);
    if (ratesRes.ok) setRates(ratesData.rates || DEFAULT_FX);
    setLoading(false);
  }

  useEffect(() => {
    load(true);
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
      load(true);
    }
  }

  async function removePerson(id) {
    const res = await fetch(`/api/person/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setPeople((prev) => prev.filter((person) => person._id !== id));
      setDeleteTarget(null);
      await load(true);
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
      load(true);
    }
  }

  function shareOnWhatsApp(person) {
    const { currency, dueAmount, dueDirection } = getPersonTotals(person);
    const remaining = Number(dueAmount || 0).toFixed(2);
    const invoiceUrl = `${window.location.origin}/api/export/person/${person._id}/invoice?scope=all&currency=${currency}`;

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

  function openInvoiceModal(person) {
    setInvoiceModal({
      personId: person._id,
      personName: person.name,
      startDate: "",
      endDate: "",
    });
  }

  function generateInvoice() {
    if (!invoiceModal) return;
    
    const currency = getInvoiceCurrency(invoiceModal.personId);
    const params = new URLSearchParams({ scope: "all", currency });
    if (invoiceModal.startDate) params.set("start", invoiceModal.startDate);
    if (invoiceModal.endDate) params.set("end", invoiceModal.endDate);
    const url = `/api/export/person/${invoiceModal.personId}/invoice?${params.toString()}`;
    window.open(url, '_blank');
    setInvoiceModal(null);
  }

  const sortedPeople = [...people].sort((a, b) => {
    const aDue = getPersonTotals(a).dueAmount;
    const bDue = getPersonTotals(b).dueAmount;
    if (bDue !== aDue) return bDue - aDue;
    return (a.name || "").localeCompare(b.name || "");
  });

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
        <Loader />
      ) : people.length === 0 ? (
        <EmptyState text="No people added yet." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sortedPeople.map((p) => {
            const totals = getPersonTotals(p);
            return (
              <article key={p._id} className="people-card rounded-2xl border border-zinc-200 bg-white p-4">
                <h3 className="people-card-title text-lg font-semibold text-black">{p.name}</h3>
                {p.email ? <p className="people-card-sub mt-1 text-sm text-zinc-600">{p.email}</p> : null}
                {p.phone ? <p className="people-card-sub text-sm text-zinc-600">{p.phone}</p> : null}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="people-card-metric rounded-lg bg-zinc-100 p-2">
                    <p className="people-card-metric-label text-zinc-500">Total Given</p>
                    <p className="people-card-metric-value font-semibold text-black">{formatCurrency(totals.pendingCredit, totals.currency)}</p>
                  </div>
                  <div className="people-card-metric rounded-lg bg-zinc-100 p-2">
                    <p className="people-card-metric-label text-zinc-500">Total Received Back</p>
                    <p className="people-card-metric-value font-semibold text-black">{formatCurrency(totals.pendingDebit, totals.currency)}</p>
                  </div>
                  <div className="people-card-metric col-span-2 rounded-lg bg-zinc-100 p-2">
                    <p className="people-card-metric-label text-zinc-500">Current Due</p>
                    <p className="people-card-metric-value font-semibold text-black">{formatCurrency(totals.dueAmount, totals.currency)}</p>
                    <p className="people-card-sub mt-1 text-zinc-600">
                      {totals.dueDirection === "person_owes_you"
                        ? `${p.name} owes you`
                        : totals.dueDirection === "you_owe_person"
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
                  className="people-card-btn w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-xs sm:w-auto"
                >
                  Edit
                </button>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <select
                    value={getInvoiceCurrency(p._id)}
                    onChange={(e) =>
                      setInvoiceCurrencies((prev) => ({
                        ...prev,
                        [p._id]: e.target.value,
                      }))
                    }
                    className="people-card-btn w-24 rounded-lg border border-zinc-300 bg-white px-2 py-2 text-xs"
                  >
                    {invoiceOptions.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => openInvoiceModal(p)}
                    className="people-card-btn rounded-lg border border-zinc-300 px-3 py-2 text-center text-xs sm:w-auto"
                  >
                    Invoice
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => shareOnWhatsApp(p)}
                  className="people-card-btn w-full rounded-lg border border-zinc-300 px-3 py-2 text-center text-xs sm:w-auto"
                >
                  Share on WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget({ id: p._id, name: p.name })}
                  className="people-card-btn w-full rounded-lg border border-black px-3 py-2 text-center text-xs sm:w-auto"
                >
                  Delete
                </button>
              </div>
            </article>
            );
            })}
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

      {invoiceModal ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-3 pt-6 sm:items-center sm:p-4">
          <div className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-5">
            <h2 className="text-lg font-semibold text-black">Generate Invoice</h2>
            <p className="mt-2 text-sm text-zinc-600">For: <span className="font-semibold">{invoiceModal.personName}</span></p>
            
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-black">From Date</label>
                <input
                  type="date"
                  value={invoiceModal.startDate}
                  onChange={(e) =>
                    setInvoiceModal((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black">To Date</label>
                <input
                  type="date"
                  value={invoiceModal.endDate}
                  onChange={(e) =>
                    setInvoiceModal((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setInvoiceModal(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={generateInvoice}
                className="rounded-lg bg-black px-4 py-2 text-sm text-white"
              >
                Generate Invoice
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
