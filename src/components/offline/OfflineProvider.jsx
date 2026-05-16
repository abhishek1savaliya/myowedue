"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hydrateApiCacheFromIndexedDB, persistApiCacheEntries } from "@/lib/offline/api-cache-persist";
import { onNetworkStatusChange, isOnline } from "@/lib/offline/network";
import { pendingMutationCount } from "@/lib/offline/mutation-queue";
import { whenApiCacheHydrated } from "@/lib/api-cache-hydration";
import { useApiCacheStore } from "@/stores/useApiCacheStore";
import OfflineBanner from "@/components/offline/OfflineBanner";

export default function OfflineProvider({ children }) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const persistTimerRef = useRef(null);
  const bootstrappedRef = useRef(false);

  const refreshPending = useCallback(async () => {
    const count = await pendingMutationCount();
    setPending(count);
  }, []);

  const runSync = useCallback(async () => {
    if (!isOnline()) return;
    setSyncing(true);
    try {
      const { syncOfflineQueue } = await import("@/lib/offline/offline-bootstrap");
      const result = await syncOfflineQueue();
      setLastSync(result);
      await refreshPending();
    } finally {
      setSyncing(false);
    }
  }, [refreshPending]);

  useEffect(() => {
    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;
      void import("@/lib/offline/offline-bootstrap").then((m) => m.bootstrapOfflineRuntime());
    }

    setOnline(isOnline());

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {});
    }

    const unsubNetwork = onNetworkStatusChange((nextOnline) => {
      setOnline(nextOnline);
      if (nextOnline) void runSync();
    });

    const unsubStore = useApiCacheStore.subscribe((state) => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        void persistApiCacheEntries(state.entries);
      }, 800);
    });

    const hydrateFromIndexedDB = () => {
      void hydrateApiCacheFromIndexedDB((key, data, fetchedAt) => {
        const existing = useApiCacheStore.getState().getEntry(key);
        if (!existing || fetchedAt > (existing.fetchedAt || 0)) {
          useApiCacheStore.setState((state) => ({
            entries: {
              ...state.entries,
              [key]: { data, fetchedAt, url: existing?.url || "" },
            },
          }));
        }
      }).then(() => refreshPending());
    };

    const unsubHydrate = whenApiCacheHydrated(() => {
      hydrateFromIndexedDB();
      if (isOnline()) void runSync();
    });

    const onQueueChanged = () => {
      void refreshPending();
    };
    window.addEventListener("owedue-offline-queue-changed", onQueueChanged);

    return () => {
      unsubNetwork();
      unsubStore();
      unsubHydrate();
      window.removeEventListener("owedue-offline-queue-changed", onQueueChanged);
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [runSync, refreshPending]);

  return (
    <>
      <OfflineBanner
        online={online}
        pending={pending}
        syncing={syncing}
        lastSync={lastSync}
        onSyncNow={() => void runSync()}
      />
      {children}
    </>
  );
}
