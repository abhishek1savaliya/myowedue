"use client";

import { create } from "zustand";
import { COMMUNITY_MUTATE_EVENT } from "@/lib/community-mutate-event";

const FETCH_LIMIT = 10;
const DEBOUNCE_MS = 450;

let debounceTimer = null;
let mutateListenerAttached = false;

function attachMutateListener(fetchTrending) {
  if (mutateListenerAttached || typeof window === "undefined") return;
  mutateListenerAttached = true;

  window.addEventListener(COMMUNITY_MUTATE_EVENT, () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      void fetchTrending();
    }, DEBOUNCE_MS);
  });
}

export const useCommunityTrendingStore = create((set, get) => ({
  topics: [],
  loading: true,
  _bootstrapped: false,

  bootstrap() {
    if (get()._bootstrapped) return;
    set({ _bootstrapped: true });
    attachMutateListener(() => get().fetchTrending());
    void get().fetchTrending();
  },

  async fetchTrending() {
    try {
      const res = await fetch(`/api/community/trending?limit=${FETCH_LIMIT}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        set({ topics: [], loading: false });
        return;
      }
      set({
        topics: Array.isArray(data.topics) ? data.topics : [],
        loading: false,
      });
    } catch {
      set({ topics: [], loading: false });
    }
  },

  refresh() {
    return get().fetchTrending();
  },
}));
