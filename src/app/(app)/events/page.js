"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, Plus, Upload, Trash2, MapPin, Clock, X } from "lucide-react";
import EmptyState from "@/components/EmptyState";

function formatDateTime(dateStr, allDay) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (allDay) {
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toInputDatetime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyForm = { title: "", description: "", location: "", startTime: "", endTime: "", allDay: false };

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // eventId to delete
  const fileRef = useRef(null);

  async function loadEvents() {
    try {
      const res = await fetch("/api/events", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setEvents(data.events || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEdit(event) {
    setEditingId(event._id);
    setForm({
      title: event.title,
      description: event.description || "",
      location: event.location || "",
      startTime: toInputDatetime(event.startTime),
      endTime: event.endTime ? toInputDatetime(event.endTime) : "",
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
          startTime: new Date(form.startTime).toISOString(),
          endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined,
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
      setEvents((prev) => prev.filter((e) => e._id !== eventId));
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
      await loadEvents();
    } catch {
      setError("Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const upcoming = events.filter((e) => new Date(e.startTime) >= new Date());
  const past = events.filter((e) => new Date(e.startTime) < new Date());

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-8">
      {/* Header */}
      <div className="mb-5 sm:mb-6">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-black sm:text-2xl">Events</h1>
            <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">
              Manage your events. Get notified 3 days, 3 hours &amp; 1 hour before.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <label
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-300 px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-black hover:text-black sm:flex-none ${importing ? "pointer-events-none opacity-60" : ""}`}
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
            onClick={openCreate}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-black px-3 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 sm:flex-none"
          >
            <Plus size={15} /> New Event
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
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
      )}

      {/* Modal form */}
      {showForm && (
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
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-400">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map((event) => (
                  <EventCard key={event._id} event={event} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-400">Past</h2>
              <div className="space-y-3">
                {past.map((event) => (
                  <EventCard key={event._id} event={event} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function EventCard({ event, onEdit, onDelete }) {
  const isPast = new Date(event.startTime) < new Date();
  return (
    <div
      className={`rounded-2xl border px-4 py-3.5 transition sm:px-5 sm:py-4 ${isPast ? "border-zinc-100 bg-zinc-50 opacity-60" : "border-zinc-200 bg-white"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-black">{event.title}</p>
          <div className="mt-1 flex flex-col gap-0.5 text-xs text-zinc-500 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatDateTime(event.startTime, event.allDay)}
              {event.endTime && <> – {formatDateTime(event.endTime, event.allDay)}</>}
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
          <div className="flex shrink-0 gap-0.5">
            <button
              onClick={() => onEdit(event)}
              className="rounded-lg px-2.5 py-2 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-black active:bg-zinc-200"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(event._id)}
              className="rounded-lg px-2.5 py-2 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-600 active:bg-red-100"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
