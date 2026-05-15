"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_CACHE_STALE_MS } from "@/lib/cache-stale";
import { createDebouncedSessionStorage } from "@/lib/debounced-storage";

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

      setEntry(key, data) {
        set((state) => ({
          entries: {
            ...state.entries,
            [key]: { data, fetchedAt: Date.now() },
          },
        }));
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
                [key]: { data, fetchedAt: Date.now() },
              },
            }));
          }

          return { data, ok: res.ok, status: res.status, fromCache: false };
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
