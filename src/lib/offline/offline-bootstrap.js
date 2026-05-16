"use client";

/** Load fetch patch + sync engine only in the browser (never on the server bundle). */
export async function bootstrapOfflineRuntime() {
  await import("@/lib/offline/install-fetch-patch");
}

export async function syncOfflineQueue() {
  const { syncPendingMutations } = await import("@/lib/offline/sync-engine");
  return syncPendingMutations();
}
