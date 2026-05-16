import { getOfflineDb } from "@/lib/offline/db";

/**
 * @param {{ url: string; method: string; body?: string | null; headers?: Record<string, string> }} payload
 */
export async function enqueueMutation(payload) {
  const db = getOfflineDb();
  if (!db) throw new Error("Offline storage unavailable");

  const id = await db.mutationQueue.add({
    url: payload.url,
    method: payload.method.toUpperCase(),
    body: payload.body ?? null,
    headers: payload.headers || {},
    createdAt: Date.now(),
    retries: 0,
  });

  return { id, ...payload };
}

export async function listPendingMutations() {
  const db = getOfflineDb();
  if (!db) return [];
  return db.mutationQueue.orderBy("createdAt").toArray();
}

/**
 * @param {number} id
 */
export async function removeMutation(id) {
  const db = getOfflineDb();
  if (!db) return;
  await db.mutationQueue.delete(id);
}

/**
 * @param {number} id
 * @param {string} lastError
 */
export async function markMutationFailed(id, lastError) {
  const db = getOfflineDb();
  if (!db) return;
  const row = await db.mutationQueue.get(id);
  if (!row) return;
  await db.mutationQueue.update(id, {
    retries: (row.retries || 0) + 1,
    lastError: String(lastError || "").slice(0, 500),
  });
}

export async function pendingMutationCount() {
  const db = getOfflineDb();
  if (!db) return 0;
  return db.mutationQueue.count();
}
