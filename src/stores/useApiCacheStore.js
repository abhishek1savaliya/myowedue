"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_CACHE_STALE_MS } from "@/lib/cache-stale";
import { createDebouncedSessionStorage } from "@/lib/debounced-storage";
import { loadApiCacheEntry, saveApiCacheEntry } from "@/lib/offline/api-cache-persist";
import { isOnline } from "@/lib/offline/network";

const DEFAULT_STALE_MS = DEFAULT_CACHE_STALE_MS;
const debouncedSessionStorage = createDebouncedSessionStorage(450);

export const useApiCacheStore = create(
  persist(
    (set, get) => ({
      entries: {},
      _inFlight: {},

      getCached(key) {
        return get().entries[key]?.data ?? null;
      },

      getEntry(key) {
        return get().entries[key] ?? null;
      },

      invalidate(key) {
        if (!key) {
          set({ entries: {} });
          return;
        }
        set((state) => {
          const entries = { ...state.entries };
          delete entries[key];
          return { entries };
        });
      },

      invalidatePrefix(prefix) {
        if (!prefix) return;
        set((state) => {
          const entries = { ...state.entries };
          Object.keys(entries).forEach((key) => {
            if (key.startsWith(prefix)) delete entries[key];
          });
          return { entries };
        });
      },

      setEntry(key, data, url = "") {
        const fetchedAt = Date.now();
        set((state) => ({
          entries: {
            ...state.entries,
            [key]: { data, fetchedAt, url: url || state.entries[key]?.url || "" },
          },
        }));
        void saveApiCacheEntry(key, data, url);
      },

      async fetch(key, url, { force = false, staleMs = DEFAULT_STALE_MS, init } = {}) {
        const entry = get().entries[key];
        const isFresh = entry && Date.now() - entry.fetchedAt < staleMs;

        if (!force && isFresh) {
          return { data: entry.data, ok: true, fromCache: true };
        }

        if (get()._inFlight[key]) {
          return get()._inFlight[key];
        }

        const request = (async () => {
          if (!isOnline()) {
            const offlineEntry = entry || (await loadApiCacheEntry(key));
            if (offlineEntry?.data != null) {
              set((state) => ({
                entries: {
                  ...state.entries,
                  [key]: {
                    data: offlineEntry.data,
                    fetchedAt: offlineEntry.fetchedAt || Date.now(),
                    url,
                  },
                },
              }));
              return {
                data: offlineEntry.data,
                ok: true,
                fromCache: true,
                offline: true,
              };
            }
            return {
              data: { message: "You are offline and no cached data is available." },
              ok: false,
              status: 503,
              offline: true,
            };
          }

          try {
            const res = await fetch(url, {
              credentials: "include",
              cache: "no-store",
              ...init,
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
              set((state) => ({
                entries: {
                  ...state.entries,
                  [key]: { data, fetchedAt: Date.now(), url },
                },
              }));
              void saveApiCacheEntry(key, data, url);
            }

            return { data, ok: res.ok, status: res.status, fromCache: false };
          } catch (err) {
            const offlineEntry = entry || (await loadApiCacheEntry(key));
            if (offlineEntry?.data != null) {
              set((state) => ({
                entries: {
                  ...state.entries,
                  [key]: {
                    data: offlineEntry.data,
                    fetchedAt: offlineEntry.fetchedAt || Date.now(),
                    url,
                  },
                },
              }));
              return {
                data: offlineEntry.data,
                ok: true,
                fromCache: true,
                offline: true,
                error: err?.message,
              };
            }
            return {
              data: { message: err?.message || "Network error" },
              ok: false,
              offline: !isOnline(),
            };
          }
        })();

        set((state) => ({
          _inFlight: { ...state._inFlight, [key]: request },
        }));

        try {
          return await request;
        } finally {
          set((state) => {
            const next = { ...state._inFlight };
            delete next[key];
            return { _inFlight: next };
          });
        }
      },
    }),
    {
      name: "owedue-api-cache-v1",
      storage: createJSONStorage(() => debouncedSessionStorage),
      partialize: (state) => ({ entries: state.entries }),
    }
  )
);
