"use client";

import { CACHE_KEYS } from "@/lib/cache-keys";
import { useApiCacheStore } from "@/stores/useApiCacheStore";

function tempId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `offline-${crypto.randomUUID()}`;
  }
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultPersonBalances() {
  return {
    totalCredit: 0,
    totalDebit: 0,
    pendingCredit: 0,
    pendingDebit: 0,
    totalCreditByCurrency: {},
    totalDebitByCurrency: {},
    pendingCreditByCurrency: {},
    pendingDebitByCurrency: {},
    netDue: 0,
    dueAmount: 0,
    dueDirection: "settled",
  };
}

function parseJson(body) {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function updatePeopleList(mutator) {
  const store = useApiCacheStore.getState();
  const entry = store.getEntry(CACHE_KEYS.people);
  const people = Array.isArray(entry?.data?.people) ? [...entry.data.people] : [];
  const next = mutator(people);
  if (!next) return;
  store.setEntry(CACHE_KEYS.people, { people: next }, "/api/person");
}

function updateEventsList(mutator) {
  const store = useApiCacheStore.getState();
  const entry = store.getEntry(CACHE_KEYS.events);
  const events = Array.isArray(entry?.data?.events) ? [...entry.data.events] : [];
  const next = mutator(events);
  if (!next) return;
  store.setEntry(CACHE_KEYS.events, { events: next }, "/api/events");
}

function updateAllTransactionLists(mutator) {
  const store = useApiCacheStore.getState();
  const keys = Object.keys(store.entries || {}).filter((k) => k.startsWith("transactions:"));
  keys.forEach((key) => {
    const entry = store.entries[key];
    const list = Array.isArray(entry?.data?.transactions) ? [...entry.data.transactions] : [];
    const next = mutator(list);
    if (!next) return;
    store.setEntry(key, { transactions: next }, entry?.url || "");
  });
}

function findPersonName(personId) {
  const people = useApiCacheStore.getState().getEntry(CACHE_KEYS.people)?.data?.people;
  if (!Array.isArray(people)) return "";
  const match = people.find((p) => String(p._id) === String(personId));
  return match?.name || "";
}

function applyPersonMutation(path, method, body) {
  const payload = parseJson(body);
  if (!payload && method !== "DELETE") return;

  if (method === "POST") {
    const id = payload?.offlineClientId || tempId();
    updatePeopleList((people) => [
      {
        _id: id,
        name: payload.name?.trim() || "New person",
        email: payload.email?.trim() || "",
        phone: payload.phone?.trim() || "",
        offlinePending: true,
        ...defaultPersonBalances(),
      },
      ...people,
    ]);
    return;
  }

  const idMatch = path.match(/\/api\/person\/([^/?]+)/);
  const id = idMatch?.[1];
  if (!id) return;

  if (method === "DELETE") {
    updatePeopleList((people) => people.filter((p) => String(p._id) !== String(id)));
    return;
  }

  if (method === "PUT" || method === "PATCH") {
    updatePeopleList((people) =>
      people.map((p) =>
        String(p._id) === String(id)
          ? {
              ...p,
              name: payload.name?.trim() ?? p.name,
              email: payload.email?.trim() ?? p.email,
              phone: payload.phone?.trim() ?? p.phone,
              offlinePending: true,
            }
          : p
      )
    );
  }
}

function applyTransactionMutation(path, method, body) {
  const payload = parseJson(body);

  if (method === "POST" && payload) {
    const id = tempId();
    const personName = findPersonName(payload.personId);
    const tx = {
      _id: id,
      personId: payload.personId
        ? { _id: payload.personId, name: personName }
        : payload.personId,
      amount: Number(payload.amount) || 0,
      type: payload.type || "credit",
      currency: payload.currency || "USD",
      notes: payload.notes || "",
      date: payload.date || new Date().toISOString(),
      offlinePending: true,
    };
    updateAllTransactionLists((list) => [tx, ...list]);
    return;
  }

  const idMatch = path.match(/\/api\/transaction\/([^/?]+)/);
  const id = idMatch?.[1];
  if (!id) return;

  if (method === "DELETE") {
    updateAllTransactionLists((list) => list.filter((t) => String(t._id) !== String(id)));
    return;
  }

  if ((method === "PUT" || method === "PATCH") && payload) {
    updateAllTransactionLists((list) =>
      list.map((t) =>
        String(t._id) === String(id)
          ? {
              ...t,
              personId: payload.personId ?? t.personId,
              amount: payload.amount != null ? Number(payload.amount) : t.amount,
              type: payload.type ?? t.type,
              currency: payload.currency ?? t.currency,
              notes: payload.notes ?? t.notes,
              date: payload.date ?? t.date,
              offlinePending: true,
            }
          : t
      )
    );
  }
}

function applyEventMutation(path, method, body) {
  const payload = parseJson(body);

  if (method === "POST" && payload) {
    const id = tempId();
    updateEventsList((events) => [
      ...events,
      {
        _id: id,
        title: payload.title?.trim() || "New event",
        description: payload.description?.trim() || "",
        location: payload.location?.trim() || "",
        startTime: payload.startTime,
        endTime: payload.endTime || payload.startTime,
        timezone: payload.timezone || "Australia/Melbourne",
        allDay: Boolean(payload.allDay),
        offlinePending: true,
      },
    ]);
    return;
  }

  const idMatch = path.match(/\/api\/events\/([^/?]+)/);
  const id = idMatch?.[1];
  if (!id) return;

  if (method === "DELETE") {
    updateEventsList((events) => events.filter((e) => String(e._id) !== String(id)));
    return;
  }

  if ((method === "PUT" || method === "PATCH") && payload) {
    updateEventsList((events) =>
      events.map((e) =>
        String(e._id) === String(id)
          ? {
              ...e,
              title: payload.title?.trim() ?? e.title,
              description: payload.description?.trim() ?? e.description,
              location: payload.location?.trim() ?? e.location,
              startTime: payload.startTime ?? e.startTime,
              endTime: payload.endTime ?? e.endTime,
              timezone: payload.timezone ?? e.timezone,
              allDay: payload.allDay ?? e.allDay,
              offlinePending: true,
            }
          : e
      )
    );
  }
}

/**
 * Update Zustand cache immediately so offline writes show in the UI.
 * @param {string} url
 * @param {string} method
 * @param {string | null} body
 */
export function applyOptimisticMutation(url, method, body) {
  const path = String(url || "").split("?")[0];
  const verb = method.toUpperCase();

  if (path.includes("/api/person")) {
    applyPersonMutation(path, verb, body);
    return;
  }
  if (path.includes("/api/transaction")) {
    applyTransactionMutation(path, verb, body);
    return;
  }
  if (path.includes("/api/events")) {
    applyEventMutation(path, verb, body);
    return;
  }
}

export function notifyOfflineQueueChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("owedue-offline-queue-changed"));
}
