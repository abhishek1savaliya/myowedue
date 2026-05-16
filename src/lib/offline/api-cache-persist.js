import { getOfflineDb } from "@/lib/offline/db";

/**
 * @param {string} key
 */
export async function loadApiCacheEntry(key) {
  const db = getOfflineDb();
  if (!db) return null;
  const row = await db.apiCache.get(key);
  if (!row) return null;
  return { data: row.data, fetchedAt: row.fetchedAt };
}

/**
 * @param {string} key
 * @param {unknown} data
 * @param {string} [url]
 */
export async function saveApiCacheEntry(key, data, url = "") {
  const db = getOfflineDb();
  if (!db) return;
  await db.apiCache.put({
    key,
    data,
    fetchedAt: Date.now(),
    url,
  });
}

/**
 * Hydrate Zustand from IndexedDB (survives tab close; larger quota than sessionStorage).
 * @param {(key: string, data: unknown, fetchedAt: number) => void} applyEntry
 */
export async function hydrateApiCacheFromIndexedDB(applyEntry) {
  const db = getOfflineDb();
  if (!db) return 0;

  const rows = await db.apiCache.toArray();
  let count = 0;
  for (const row of rows) {
    if (row?.key != null && row.data != null) {
      applyEntry(row.key, row.data, row.fetchedAt || Date.now());
      count += 1;
    }
  }
  return count;
}

/**
 * @param {Record<string, { data: unknown; fetchedAt: number }>} entries
 */
export async function persistApiCacheEntries(entries) {
  const db = getOfflineDb();
  if (!db || !entries) return;

  const rows = Object.entries(entries).map(([key, entry]) => ({
    key,
    data: entry.data,
    fetchedAt: entry.fetchedAt || Date.now(),
  }));

  if (!rows.length) return;
  await db.apiCache.bulkPut(rows);
}
