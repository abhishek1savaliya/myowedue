import { algoliasearch } from "algoliasearch";

const DEFAULT_INDEX = "community_usernames";
let cachedClient = null;

function getAlgoliaConfig() {
  const appId = process.env.ALGOLIA_APP_ID || "";
  const apiKey = process.env.ALGOLIA_ADMIN_API_KEY || process.env.ALGOLIA_SEARCH_API_KEY || "";
  const indexName = process.env.ALGOLIA_COMMUNITY_USERNAME_INDEX || DEFAULT_INDEX;
  if (!appId || !apiKey) return null;
  return { appId, apiKey, indexName };
}

function getAlgoliaClient() {
  const cfg = getAlgoliaConfig();
  if (!cfg) return null;
  if (!cachedClient) cachedClient = algoliasearch(cfg.appId, cfg.apiKey);
  return { client: cachedClient, indexName: cfg.indexName };
}

export async function searchCommunityUsernamesWithAlgolia(prefix, limit = 12) {
  const entry = getAlgoliaClient();
  if (!entry) return null;
  const query = String(prefix || "").trim().toLowerCase();
  if (!query) return [];
  try {
    const res = await entry.client.searchSingleIndex({
      indexName: entry.indexName,
      searchParams: {
        query,
        hitsPerPage: Math.min(Math.max(Number(limit) || 12, 1), 50),
      },
    });
    const hits = Array.isArray(res?.hits) ? res.hits : [];
    const out = hits
      .map((h) => String(h?.username || "").toLowerCase())
      .filter((u) => u && u.startsWith(query));
    return [...new Set(out)];
  } catch {
    return null;
  }
}

export async function lookupCommunityUsernameInAlgolia(username) {
  const entry = getAlgoliaClient();
  if (!entry) return null;
  const query = String(username || "").trim().toLowerCase();
  if (!query) return null;
  try {
    const res = await entry.client.searchSingleIndex({
      indexName: entry.indexName,
      searchParams: {
        query,
        hitsPerPage: 8,
      },
    });
    const hits = Array.isArray(res?.hits) ? res.hits : [];
    const exact = hits.find((h) => String(h?.username || "").toLowerCase() === query);
    if (!exact) return null;
    return {
      userId: String(exact.userId || exact.objectID || ""),
      username: String(exact.username || "").toLowerCase(),
    };
  } catch {
    return null;
  }
}

export async function upsertCommunityUsernameInAlgolia({ userId, username }) {
  const entry = getAlgoliaClient();
  if (!entry) return false;
  const cleanUsername = String(username || "").trim().toLowerCase();
  const cleanUserId = String(userId || "").trim();
  if (!cleanUsername || !cleanUserId) return false;
  try {
    await entry.client.saveObjects({
      indexName: entry.indexName,
      objects: [{ objectID: cleanUserId, userId: cleanUserId, username: cleanUsername }],
    });
    return true;
  } catch {
    return false;
  }
}

export async function bulkUpsertCommunityUsernamesInAlgolia(items) {
  const entry = getAlgoliaClient();
  if (!entry) return { ok: false, indexed: 0 };
  const source = Array.isArray(items) ? items : [];
  const objects = source
    .map((it) => ({
      objectID: String(it?.userId || "").trim(),
      userId: String(it?.userId || "").trim(),
      username: String(it?.username || "").trim().toLowerCase(),
    }))
    .filter((o) => o.objectID && o.username);
  if (objects.length === 0) return { ok: true, indexed: 0 };
  try {
    await entry.client.saveObjects({
      indexName: entry.indexName,
      objects,
    });
    return { ok: true, indexed: objects.length };
  } catch {
    return { ok: false, indexed: 0 };
  }
}

