"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { COMMUNITY_MUTATE_EVENT } from "@/lib/community-mutate-event";

const FETCH_LIMIT = 10;
const DEBOUNCE_MS = 450;
const STALE_MS = 5 * 60 * 1000;

let debounceTimer = null;
let mutateListenerAttached = false;

function attachMutateListener(fetchTrending) {
  if (mutateListenerAttached || typeof window === "undefined") return;
  mutateListenerAttached = true;

  window.addEventListener(COMMUNITY_MUTATE_EVENT, () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      void fetchTrending({ force: true });
    }, DEBOUNCE_MS);
  });
}

export const useCommunityTrendingStore = create(
  persist(
    (set, get) => ({
      topics: [],
      loading: true,
      fetchedAt: 0,
      _bootstrapped: false,

      bootstrap() {
        if (get()._bootstrapped) {
          const isFresh = get().fetchedAt > 0 && Date.now() - get().fetchedAt < STALE_MS;
          if (isFresh) {
            set({ loading: false });
            return;
          }
          void get().fetchTrending();
          return;
        }
        set({ _bootstrapped: true });
        attachMutateListener(() => get().fetchTrending());
        const isFresh = get().fetchedAt > 0 && Date.now() - get().fetchedAt < STALE_MS;
        if (isFresh && get().topics.length) {
          set({ loading: false });
          return;
        }
        void get().fetchTrending();
      },

      async fetchTrending({ force = false } = {}) {
        const isFresh = get().fetchedAt > 0 && Date.now() - get().fetchedAt < STALE_MS;
        if (!force && isFresh && get().topics.length) {
          set({ loading: false });
          return;
        }

        set({ loading: get().topics.length === 0 });

        try {
          const res = await fetch(`/api/community/trending?limit=${FETCH_LIMIT}`, {
            credentials: "include",
            cache: "no-store",
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            set({ topics: [], loading: false, fetchedAt: Date.now() });
            return;
          }
          set({
            topics: Array.isArray(data.topics) ? data.topics : [],
            loading: false,
            fetchedAt: Date.now(),
          });
        } catch {
          set({ topics: get().topics, loading: false });
        }
      },

      refresh() {
        return get().fetchTrending({ force: true });
      },
    }),
    {
      name: "owedue-trending-v1",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        topics: state.topics,
        fetchedAt: state.fetchedAt,
      }),
    }
  )
);
