"use client";

import { invalidateCachesForUrl } from "@/lib/offline/invalidate-from-url";
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
  if (!isOnline() || syncing) {
    return { synced: 0, failed: 0, remaining: await listPendingMutations().then((r) => r.length) };
  }

  syncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const queue = await listPendingMutations();
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
          invalidateCachesForUrl(item.url);
          if (String(item.url || "").includes("/api/community")) {
            dispatchCommunityMutate();
          }
          synced += 1;
        } else {
          await markMutationFailed(item.id, data?.message || `HTTP ${res.status}`);
          failed += 1;
        }
      } catch (err) {
        await markMutationFailed(item.id, err?.message || "Network error");
        failed += 1;
        break;
      }
    }

    if (synced > 0) {
      await refreshStaleApiCaches();
    }
  } finally {
    syncing = false;
  }

  const remaining = (await listPendingMutations()).length;
  return { synced, failed, remaining };
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
