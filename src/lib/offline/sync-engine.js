"use client";

import { isOnline } from "@/lib/offline/network";
import {
  listPendingMutations,
  markMutationFailed,
  removeMutation,
} from "@/lib/offline/mutation-queue";
import { dispatchCommunityMutate } from "@/lib/community-mutate-event";
import { getNativeFetch } from "@/lib/offline/client-fetch";
import { useApiCacheStore } from "@/stores/useApiCacheStore";

let syncing = false;

/**
 * Push queued mutations to the server (FIFO).
 * @returns {Promise<{ synced: number; failed: number; remaining: number }>}
 */
export async function syncPendingMutations() {
  return syncPendingMutationsForUser();
}

/**
 * @param {string | null | undefined} userId
 * @returns {Promise<{ synced: number; failed: number; remaining: number; total: number; processed: number }>}
 */
export async function syncPendingMutationsForUser(userId) {
  if (!isOnline() || syncing) {
    const remaining = await listPendingMutations(userId).then((r) => r.length);
    return { synced: 0, failed: 0, remaining, total: remaining, processed: 0 };
  }

  syncing = true;
  let synced = 0;
  let failed = 0;
  let processed = 0;

  try {
    const queue = await listPendingMutations(userId);
    const total = queue.length;
    emitSyncProgress({ total, processed, synced, failed, phase: "start" });
    const communityIdMaps = { posts: new Map(), comments: new Map() };
    const communityOffline = await import("@/lib/offline/community-pending");

    for (const item of queue) {
      if (!item?.id) continue;

      try {
        const resolved = communityOffline.resolveCommunityOfflineMutation(item, communityIdMaps);
        const nf = getNativeFetch() || fetch.bind(globalThis);
        const res = await nf(resolved.url, {
          method: item.method,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...item.headers,
          },
          body: resolved.body || undefined,
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          communityOffline.recordCommunitySyncIds(item, data, communityIdMaps);
          await removeMutation(item.id);
          const { invalidateCachesForUrl } = await import("@/lib/offline/invalidate-from-url");
          invalidateCachesForUrl(item.url);
          if (String(item.url || "").includes("/api/community")) {
            dispatchCommunityMutate();
          }
          synced += 1;
        } else {
          await markMutationFailed(item.id, data?.message || `HTTP ${res.status}`);
          failed += 1;
        }
        processed += 1;
        emitSyncProgress({ total, processed, synced, failed, current: item, phase: "progress" });
      } catch (err) {
        await markMutationFailed(item.id, err?.message || "Network error");
        failed += 1;
        processed += 1;
        emitSyncProgress({ total, processed, synced, failed, current: item, phase: "error" });
        break;
      }
    }

    if (synced > 0) {
      await refreshStaleApiCaches();
    }
  } finally {
    syncing = false;
  }

  const remaining = (await listPendingMutations(userId)).length;
  const total = synced + failed + remaining;
  emitSyncProgress({ total, processed, synced, failed, remaining, phase: "done" });
  return { synced, failed, remaining, total, processed };
}

/** Re-fetch cached API data after sync so UI matches server. */
async function refreshStaleApiCaches() {
  const { refreshAppCache } = await import("@/lib/refresh-app-cache");
  refreshAppCache(["people", "transactions", "events", "dashboard", "cards", "files", "subscription", "bin"]);

  const store = useApiCacheStore.getState();
  const keys = Object.keys(store.entries || {});

  await Promise.all(
    keys.map(async (key) => {
      const entry = store.entries[key];
      if (!entry?.url) return;
      try {
        await store.fetch(key, entry.url, { force: true });
      } catch {
        // keep cached data
      }
    })
  );
}

export function isSyncInProgress() {
  return syncing;
}

function emitSyncProgress(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("owedue-offline-sync-progress", { detail }));
}
