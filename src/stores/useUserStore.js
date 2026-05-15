"use client";

import { create } from "zustand";

const STALE_MS = 45_000;

export const useUserStore = create((set, get) => ({
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
      set({ status: state.user ? "ready" : "loading" });

      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data?.user) {
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
}));
