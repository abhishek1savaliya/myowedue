"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, FileDown, Loader2, Plus, Upload, Trash2, MapPin, Clock, X } from "lucide-react";
import moment from "moment-timezone";
import EmptyState from "@/components/EmptyState";
import ModalPortal from "@/components/ModalPortal";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { buildEventsPdf, downloadPdfBytes } from "@/lib/events-pdf";
import { CACHE_KEYS } from "@/lib/cache-keys";
import EventsInsightsUpsell from "@/components/events/EventsInsightsUpsell";
import EventsPremiumInsights from "@/components/events/EventsPremiumInsights";
import { buildEventsInsights } from "@/lib/events-insights";
import { refreshAppCache } from "@/lib/refresh-app-cache";
import { useUserStore } from "@/stores/useUserStore";

const DEFAULT_TIMEZONE = "Australia/Melbourne";
const TIMEZONE_OPTIONS = [
  "Australia/Melbourne",
  "Australia/Sydney",
  "Australia/Perth",
  "Australia/Brisbane",
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
];

function formatDateTime(dateStr, allDay, timezone = DEFAULT_TIMEZONE) {
  if (!dateStr) return "";
  const m = moment(dateStr).tz(timezone);
  if (allDay) {
    return m.format("ddd, MMM D, YYYY");
  }
  return `${m.format("ddd, MMM D, YYYY h:mm A")} (${m.format("z")})`;
}

function toInputDatetime(dateStr, timezone = DEFAULT_TIMEZONE) {
  if (!dateStr) return "";
  return moment(dateStr).tz(timezone).format("YYYY-MM-DDTHH:mm");
}

const emptyForm = {
  title: "",
  description: "",
  location: "",
  startTime: "",
  endTime: "",
  timezone: DEFAULT_TIMEZONE,
  allDay: false,
};

export default function EventsPage() {
  const isPremium = useUserStore((s) => s.user?.isPremium);
  const { data, loading, refresh } = useCachedFetch(CACHE_KEYS.events, "/api/events");
  const events = useMemo(() => data?.events || [], [data]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // eventId to delete
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [pdfBusy, setPdfBusy] = useState(false);
  const fileRef = useRef(null);

  function invalidateAfterMutation() {
    refreshAppCache(["events", "bin", "dashboard"]);
    refresh();
  }

  useEffect(() => {
    const valid = new Set(events.map((e) => String(e._id)));
    setSelectedIds((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
      });
      return next;
    });
  }, [events]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEdit(event) {
    const timezone = event.timezone || DEFAULT_TIMEZONE;
    setEditingId(event._id);
    setForm({
      title: event.title,
      description: event.description || "",
      location: event.location || "",
      startTime: toInputDatetime(event.startTime, timezone),
      endTime: event.endTime ? toInputDatetime(event.endTime, timezone) : "",
      timezone,
      allDay: Boolean(event.allDay),
    });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title is required"); return; }
    if (!form.startTime) { setError("Start time is required"); return; }
    setSaving(true);
    setError("");
    try {
      const url = editingId ? `/api/events/${editingId}` : "/api/events";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          location: form.location.trim(),
          startTime: moment.tz(form.startTime, form.timezone || DEFAULT_TIMEZONE).toISOString(),
          endTime: form.endTime
            ? moment.tz(form.endTime, form.timezone || DEFAULT_TIMEZONE).toISOString()
            : undefined,
          timezone: form.timezone || DEFAULT_TIMEZONE,
          allDay: form.allDay,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message || "Failed to save event");
        return;
      }
      setShowForm(false);
      await loadEvents();
    } catch {
      setError("Failed to save event");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(eventId) {
    setConfirmDelete(eventId);
  }

  async function confirmDeleteEvent() {
    const eventId = confirmDelete;
    setConfirmDelete(null);
    try {
      await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      invalidateAfterMutation();
    } catch {
      /* ignore */
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/events/import", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Import failed");
        return;
      }
      invalidateAfterMutation();
    } catch {
      setError("Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const upcoming = events.filter((e) => new Date(e.startTime) >= new Date());
  const past = events.filter((e) => new Date(e.startTime) < new Date());

  const eventsInsights = useMemo(() => buildEventsInsights(events), [events]);

  const selectedCount = selectedIds.size;
  const allSelected = events.length > 0 && selectedCount === events.length;

  const toggleSelect = useCallback((id) => {
    const s = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(events.map((e) => String(e._id))));
  }, [events]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const sortByStart = useCallback((list) => [...list].sort((a, b) => new Date(a.startTime) - new Date(b.startTime)), []);

  const runPdfExport = useCallback(
    async (list, subtitle) => {
      if (!list.length) return;
      setPdfBusy(true);
      setError("");
      try {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const bytes = await buildEventsPdf({
          events: sortByStart(list),
          title: "Events",
          subtitle,
          appUrl: origin || process.env.NEXT_PUBLIC_SITE_URL || undefined,
        });
        const day = moment().format("YYYY-MM-DD");
        downloadPdfBytes(bytes, `myowedue-events-${day}.pdf`);
      } catch {
        setError("Could not create PDF. Try again.");
      } finally {
        setPdfBusy(false);
      }
    },
    [sortByStart]
  );

  const exportPdfAll = useCallback(() => {
    if (!isPremium) {
      window.location.href = "/my-subscription?purchase=1";
      return;
    }
    void runPdfExport(events, `All events (${events.length})`);
  }, [events, isPremium, runPdfExport]);

  const exportPdfSelected = useCallback(() => {
    if (!isPremium) {
      window.location.href = "/my-subscription?purchase=1";
      return;
    }
    const picked = events.filter((e) => selectedIds.has(String(e._id)));
    void runPdfExport(picked, `Selected events (${picked.length})`);
  }, [events, isPremium, selectedIds, runPdfExport]);

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-8">
      {/* Header */}
      <div className="mb-5 sm:mb-6">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">Events</h1>
            <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">
              Manage your events. Get notified 3 days, 3 hours &amp; 1 hour before.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 sm:flex-none ${importing ? "pointer-events-none opacity-60" : ""}`}
            title="Import .ics file"
          >
            <Upload size={15} />
            {importing ? "Importing…" : "Import .ics"}
            <input
              ref={fileRef}
              type="file"
              accept=".ics,text/calendar"
              className="hidden"
              onChange={handleImport}
              disabled={importing}
            />
          </label>
          <button
            type="button"
            onClick={openCreate}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:flex-none"
          >
            <Plus size={15} /> New Event
          </button>
        </div>
      </div>

      {!loading && events.length > 0 ? (
        <div className="mb-5">
          {isPremium ? <EventsPremiumInsights insights={eventsInsights} /> : <EventsInsightsUpsell />}
        </div>
      ) : null}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-black">Delete event?</h2>
            <p className="mt-1 text-sm text-zinc-500">
              This event will be moved to the Bin and can be restored within 3 years.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-black"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteEvent}
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Modal form */}
      {showForm && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:px-4">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-black">{editingId ? "Edit Event" : "New Event"}</h2>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-black">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Title *</label>
                <input
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-black"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Event title"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Start *</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-black"
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">End</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-black"
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Time zone</label>
                <select
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
                  value={form.timezone}
                  onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-zinc-500">Default: Australia/Melbourne</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="allDay"
                  type="checkbox"
                  checked={form.allDay}
                  onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
                  className="h-4 w-4 rounded"
                />
                <label htmlFor="allDay" className="text-sm text-zinc-700">All-day event</label>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Location</label>
                <input
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-black"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Optional location"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Description</label>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-black"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-700 hover:border-black sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 sm:w-auto"
                >
                  {saving ? "Saving…" : editingId ? "Save Changes" : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Event list */}
      {loading ? (
        <div className="py-16 text-center text-sm text-zinc-400">Loading events…</div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No events yet"
          description="Create an event or import a .ics calendar file to get started."
        />
      ) : (
        <div className="space-y-8">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {isPremium ? "Export PDF (matches app theme)" : "Premium PDF export — upgrade to Pro"}
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={allSelected ? clearSelection : selectAll}
                  disabled={pdfBusy}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {allSelected ? "Clear selection" : "Select all"}
                </button>
                {selectedCount > 0 ? (
                  <span className="self-center text-xs text-zinc-500 dark:text-zinc-400">
                    {selectedCount} selected
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={exportPdfAll}
                  disabled={pdfBusy}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:flex-none"
                >
                  {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                  {isPremium ? "All events" : "All events (Pro)"}
                </button>
                <button
                  type="button"
                  onClick={exportPdfSelected}
                  disabled={pdfBusy || selectedCount === 0}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:flex-none"
                >
                  {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                  {isPremium ? "Selected" : "Selected (Pro)"}
                </button>
              </div>
            </div>
          </div>

          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-400">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map((event) => (
                  <EventCard
                    key={event._id}
                    event={event}
                    selected={selectedIds.has(String(event._id))}
                    onToggleSelect={() => toggleSelect(event._id)}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-400">Past</h2>
              <div className="space-y-3">
                {past.map((event) => (
                  <EventCard
                    key={event._id}
                    event={event}
                    selected={selectedIds.has(String(event._id))}
                    onToggleSelect={() => toggleSelect(event._id)}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function EventCard({ event, selected, onToggleSelect, onEdit, onDelete }) {
  const isPast = new Date(event.startTime) < new Date();
  const timezone = event.timezone || DEFAULT_TIMEZONE;
  return (
    <div
      className={`rounded-xl border px-3 py-3.5 transition sm:px-4 sm:py-4 ${isPast ? "border-zinc-100 bg-zinc-50/90 opacity-80 dark:border-zinc-800 dark:bg-zinc-900/50" : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900/60"}`}
    >
      <div className="flex items-start gap-3">
        <label className="mt-0.5 flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:focus:ring-zinc-500"
            aria-label={`Select ${event.title}`}
          />
        </label>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{event.title}</p>
          <div className="mt-1 flex flex-col gap-0.5 text-xs text-zinc-500 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatDateTime(event.startTime, event.allDay, timezone)}
              {event.endTime && <> – {formatDateTime(event.endTime, event.allDay, timezone)}</>}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin size={12} /> {event.location}
              </span>
            )}
          </div>
          {event.description && (
            <p className="mt-1.5 text-xs text-zinc-500 line-clamp-2">{event.description}</p>
          )}
        </div>
        {!isPast && (
          <div className="flex shrink-0 gap-0.5 self-start">
            <button
              type="button"
              onClick={() => onEdit(event)}
              className="rounded-lg px-2.5 py-2 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(event._id)}
              className="rounded-lg px-2.5 py-2 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-600 active:bg-red-100 dark:hover:bg-red-950/40"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
