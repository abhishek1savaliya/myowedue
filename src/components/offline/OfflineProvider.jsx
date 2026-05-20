"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hydrateApiCacheFromIndexedDB, persistApiCacheEntries } from "@/lib/offline/api-cache-persist";
import { onNetworkStatusChange, isOnline } from "@/lib/offline/network";
import { listPendingMutations, pendingMutationCount } from "@/lib/offline/mutation-queue";
import { whenApiCacheHydrated } from "@/lib/api-cache-hydration";
import { useApiCacheStore } from "@/stores/useApiCacheStore";
import { useUserStore } from "@/stores/useUserStore";
import OfflineBanner from "@/components/offline/OfflineBanner";
import PendingSyncModal from "@/components/offline/PendingSyncModal";

export default function OfflineProvider({ children }) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [queueItems, setQueueItems] = useState([]);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const persistTimerRef = useRef(null);
  const bootstrappedRef = useRef(false);
  const userId = useUserStore((s) => s.user?._id || null);

  const refreshPending = useCallback(async () => {
    const count = await pendingMutationCount(userId);
    setPending(count);
    const rows = await listPendingMutations(userId);
    setQueueItems(rows);
  }, [userId]);

  const runSync = useCallback(async (manual = false) => {
    if (!isOnline()) return;
    setSyncing(true);
    setSyncProgress(null);
    try {
      const { syncOfflineQueue } = await import("@/lib/offline/offline-bootstrap");
      const result = await syncOfflineQueue(userId, { manual });
      setLastSync(result);
      await refreshPending();
    } finally {
      setSyncing(false);
    }
  }, [refreshPending, userId]);

  useEffect(() => {
    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;
      void import("@/lib/offline/offline-bootstrap").then((m) => m.bootstrapOfflineRuntime());
    }

    const onlineNow = isOnline();
    setOnline(onlineNow);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {});
    }

    const unsubNetwork = onNetworkStatusChange((nextOnline) => {
      setOnline(nextOnline);
      if (nextOnline) void runSync(false);
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
      if (isOnline()) void runSync(false);
    });

    const onQueueChanged = () => {
      void refreshPending();
    };
    window.addEventListener("owedue-offline-queue-changed", onQueueChanged);

    const onSyncProgress = (event) => {
      const detail = event?.detail || {};
      setSyncProgress({
        processed: Number(detail.processed || 0),
        total: Number(detail.total || 0),
        synced: Number(detail.synced || 0),
        failed: Number(detail.failed || 0),
      });
      if (detail.phase === "done") {
        void refreshPending();
      }
    };
    window.addEventListener("owedue-offline-sync-progress", onSyncProgress);

    void refreshPending();
    if (onlineNow) {
      void runSync(false);
    }

    return () => {
      unsubNetwork();
      unsubStore();
      unsubHydrate();
      window.removeEventListener("owedue-offline-queue-changed", onQueueChanged);
      window.removeEventListener("owedue-offline-sync-progress", onSyncProgress);
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [runSync, refreshPending, userId]);

  return (
    <>
      <OfflineBanner
        online={online}
        pending={pending}
        syncing={syncing}
        lastSync={lastSync}
        syncProgress={syncProgress}
        onSyncNow={() => void runSync(true)}
        onViewPending={() => setSyncModalOpen(true)}
      />
      <PendingSyncModal
        open={syncModalOpen}
        items={queueItems}
        progress={syncProgress}
        syncing={syncing}
        onClose={() => setSyncModalOpen(false)}
        onSyncNow={() => void runSync(true)}
      />
      {children}
    </>
  );
}
