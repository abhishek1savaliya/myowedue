import { getOfflineDb } from "@/lib/offline/db";

/**
 * @param {{ url: string; method: string; body?: string | null; headers?: Record<string, string>; userId?: string | null }} payload
 */
export async function enqueueMutation(payload) {
  const db = getOfflineDb();
  if (!db) throw new Error("Offline storage unavailable");

  const id = await db.mutationQueue.add({
    url: payload.url,
    method: payload.method.toUpperCase(),
    body: payload.body ?? null,
    headers: payload.headers || {},
    userId: payload.userId || null,
    createdAt: Date.now(),
    retries: 0,
  });

  return { id, ...payload };
}

/**
 * @param {string | null | undefined} [userId]
 */
export async function listPendingMutations(userId) {
  const db = getOfflineDb();
  if (!db) return [];
  const queue = await db.mutationQueue.orderBy("createdAt").toArray();
  if (!userId) return queue;
  return queue.filter((item) => !item?.userId || String(item.userId) === String(userId));
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

/**
 * @param {string | null | undefined} [userId]
 */
export async function pendingMutationCount(userId) {
  const db = getOfflineDb();
  if (!db) return 0;
  if (!userId) return db.mutationQueue.count();
  const queue = await db.mutationQueue.toArray();
  return queue.filter((item) => !item?.userId || String(item.userId) === String(userId)).length;
}
