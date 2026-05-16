"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createDebouncedSessionStorage } from "@/lib/debounced-storage";
import { CACHE_KEYS } from "@/lib/cache-keys";
import { useApiCacheStore } from "@/stores/useApiCacheStore";

const debouncedSessionStorage = createDebouncedSessionStorage(450);

const STALE_MS = 5 * 60 * 1000;

export const useUserStore = create(
  persist(
    (set, get) => ({
      user: null,
      status: "idle",
      fetchedAt: 0,
      _inFlight: null,

      setUser(user) {
        set({
          user: user ?? null,
          status: "ready",
          fetchedAt: Date.now(),
        });
      },

      clearUser() {
        set({ user: null, status: "ready", fetchedAt: 0, _inFlight: null });
      },

      invalidate() {
        set({ fetchedAt: 0 });
      },

      async fetchUser({ force = false } = {}) {
        const state = get();
        const isFresh = state.fetchedAt > 0 && Date.now() - state.fetchedAt < STALE_MS;

        if (!force && isFresh && state.status === "ready") {
          return state.user;
        }

        if (state._inFlight) {
          return state._inFlight;
        }

        const request = (async () => {
          if (!state.user) {
            set({ status: "loading" });
          }

          try {
            const res = await fetch("/api/auth/me", {
              credentials: "include",
              cache: "no-store",
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok && data?.user) {
              useApiCacheStore.getState().setEntry(CACHE_KEYS.user, { user: data.user });
              set({
                user: data.user,
                status: "ready",
                fetchedAt: Date.now(),
                _inFlight: null,
              });
              return data.user;
            }

            set({
              user: null,
              status: "ready",
              fetchedAt: Date.now(),
              _inFlight: null,
            });
            return null;
          } catch {
            set({
              user: state.user,
              status: "error",
              _inFlight: null,
            });
            return state.user;
          }
        })();

        set({ _inFlight: request });
        return request;
      },
    }),
    {
      name: "owedue-user-v1",
      storage: createJSONStorage(() => debouncedSessionStorage),
      partialize: (state) => ({
        user: state.user,
        fetchedAt: state.fetchedAt,
        status: state.user ? "ready" : state.status,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state?.user) return;
        // Subscription fields (isPremium, etc.) go stale in sessionStorage — refetch on load.
        state.fetchedAt = 0;
        state.status = "loading";
      },
    }
  )
);
