"use client";

/** Load fetch patch + sync engine only in the browser (never on the server bundle). */
export async function bootstrapOfflineRuntime() {
  await import("@/lib/offline/install-fetch-patch");
}

export async function syncOfflineQueue(userId) {
  const { syncPendingMutationsForUser } = await import("@/lib/offline/sync-engine");
  return syncPendingMutationsForUser(userId);
}
