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
 * @param {{ manual?: boolean }} [options]
 * @returns {Promise<{ synced: number; failed: number; remaining: number; total: number; processed: number }>}
 */
export async function syncPendingMutationsForUser(userId, options = {}) {
  const manual = Boolean(options?.manual);
  const MAX_AUTO_RETRIES = 3;
  let total = 0;
  if (!isOnline() || syncing) {
    const remaining = await listPendingMutations(userId).then((r) => r.length);
    return { synced: 0, failed: 0, remaining, total: remaining, processed: 0 };
  }

  syncing = true;
  let synced = 0;
  let failed = 0;
  let processed = 0;

  try {
    const queueAll = await listPendingMutations(userId);
    const queue = manual ? queueAll : queueAll.filter((item) => Number(item?.retries || 0) < MAX_AUTO_RETRIES);
    total = queue.length;
    emitSyncProgress({ total, processed, synced, failed, phase: "start" });
    const offlineIdMaps = { persons: new Map(), legacyCreatedPersonIds: [], posts: new Map(), comments: new Map() };
    const communityIdMaps = { posts: new Map(), comments: new Map() };
    const communityOffline = await import("@/lib/offline/community-pending");

    for (const item of queue) {
      if (!item?.id) continue;

      try {
        const resolved = resolveOfflineMutation(item, offlineIdMaps, communityOffline, communityIdMaps);
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
          recordPersonSyncIds(item, resolved.body, data, offlineIdMaps);
          communityOffline.recordCommunitySyncIds(item, data, communityIdMaps);
          await removeMutation(item.id);
          const { invalidateCachesForUrl } = await import("@/lib/offline/invalidate-from-url");
          invalidateCachesForUrl(item.url);
          if (String(item.url || "").includes("/api/community")) {
            dispatchCommunityMutate();
          }
          synced += 1;
        } else {
          const message = String(data?.message || `HTTP ${res.status}`);
          if (shouldDiscardMutation(item, resolved.url, res.status, message)) {
            await removeMutation(item.id);
          } else {
            await markMutationFailed(item.id, message);
          }
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

function resolveOfflineMutation(item, offlineIdMaps, communityOffline, communityIdMaps) {
  const resolvedCommunity = communityOffline.resolveCommunityOfflineMutation(item, communityIdMaps);
  let body = resolvedCommunity.body;
  if (body) {
    try {
      const json = JSON.parse(body);
      if (json?.personId && offlineIdMaps.persons.has(String(json.personId))) {
        json.personId = offlineIdMaps.persons.get(String(json.personId));
      } else if (
        json?.personId &&
        String(json.personId).startsWith("offline-") &&
        offlineIdMaps.legacyCreatedPersonIds.length === 1
      ) {
        // Legacy fallback for old queued items created before offlineClientId existed.
        json.personId = offlineIdMaps.legacyCreatedPersonIds[0];
      }
      body = JSON.stringify(json);
    } catch {
      // keep original body
    }
  }
  return { url: resolvedCommunity.url, body };
}

function recordPersonSyncIds(item, resolvedBody, data, offlineIdMaps) {
  const path = String(item?.url || "").split("?")[0];
  if (String(item?.method || "").toUpperCase() !== "POST" || !/\/api\/person\/?$/.test(path)) return;
  if (!resolvedBody) return;
  try {
    const body = JSON.parse(resolvedBody);
    const offlineClientId = body?.offlineClientId;
    const realPersonId = data?.person?._id || data?.person?.id;
    if (realPersonId) {
      const real = String(realPersonId);
      if (offlineClientId) {
        offlineIdMaps.persons.set(String(offlineClientId), real);
      } else {
        offlineIdMaps.legacyCreatedPersonIds.push(real);
      }
    }
  } catch {
    // ignore parse issues
  }
}

function shouldDiscardMutation(item, resolvedUrl, status, message) {
  const method = String(item?.method || "").toUpperCase();
  const url = String(resolvedUrl || item?.url || "");
  const lowerMessage = String(message || "").toLowerCase();

  const hasOfflineRefInUrl = /\/offline-[^/?]+/.test(url);
  if (hasOfflineRefInUrl && method !== "POST") return true;

  if (lowerMessage.includes("invalid input syntax for type uuid") && lowerMessage.includes("offline-")) {
    return true;
  }

  // Client-side validation/resource errors are typically permanent for queued payloads.
  if (status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 409 && status !== 429) {
    return true;
  }

  return false;
}
