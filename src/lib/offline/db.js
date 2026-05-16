import Dexie from "dexie";

/** @typedef {{ key: string; data: unknown; fetchedAt: number; url?: string }} ApiCacheRow */
/** @typedef {{ id?: number; url: string; method: string; body: string | null; headers: Record<string, string>; createdAt: number; retries: number; lastError?: string }} MutationRow */

export class OweDueOfflineDB extends Dexie {
  constructor() {
    super("owedue-offline");

    this.version(1).stores({
      apiCache: "key, fetchedAt",
      mutationQueue: "++id, createdAt, url",
      meta: "key",
    });
  }
}

/** @type {OweDueOfflineDB | null} */
let dbInstance = null;

export function getOfflineDb() {
  if (typeof indexedDB === "undefined") return null;
  if (!dbInstance) dbInstance = new OweDueOfflineDB();
  return dbInstance;
}
