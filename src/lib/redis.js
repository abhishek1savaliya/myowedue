import { Redis } from "@upstash/redis";

let redisDisabledUntil = 0;
let client = null;
const NOTIFICATION_CHANNEL = "notifications:events";

function isRedisTemporarilyDisabled() {
  return Date.now() < redisDisabledUntil;
}

function disableRedisFor(ms = 30000) {
  redisDisabledUntil = Date.now() + ms;
}

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_TOKEN;

  if (!url || !token) return null;
  return { url, token };
}

function hasRedisConfig() {
  return Boolean(getRedisConfig());
}

function handleRedisError(context, error) {
  console.error(`${context}:`, error?.message || error);
  const text = String(error?.message || error || "").toLowerCase();
  if (
    text.includes("timeout") ||
    text.includes("econnrefused") ||
    text.includes("429") ||
    text.includes("too many") ||
    text.includes("fetch failed")
  ) {
    disableRedisFor(30000);
  }
}

export async function getRedisClient() {
  if (!hasRedisConfig()) return null;
  if (isRedisTemporarilyDisabled()) return null;

  if (!client) {
    const config = getRedisConfig();
    if (!config) return null;

    client = new Redis({
      ...config,
      automaticDeserialization: false,
    });
  }

  return client;
}

export async function getRedisJSON(key) {
  try {
    const client = await getRedisClient();
    if (!client) return null;

    const value = await client.get(key);
    if (value == null) return null;
    if (typeof value !== "string") return value;

    return JSON.parse(value);
  } catch (error) {
    handleRedisError("Redis get failed", error);
    return null;
  }
}

export async function setRedisJSON(key, data, ttlSeconds = 120) {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    await client.set(key, JSON.stringify(data), { ex: ttlSeconds });
    return true;
  } catch (error) {
    handleRedisError("Redis set failed", error);
    return false;
  }
}

export async function delRedisKey(key) {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    await client.del(key);
    return true;
  } catch (error) {
    handleRedisError("Redis delete failed", error);
    return false;
  }
}

function encodeKeyPart(value) {
  const raw = String(value || "default");
  return Buffer.from(raw).toString("base64url");
}

export function dashboardCacheKey(userId, currency = "AUD") {
  return `dashboard:${String(userId)}:${String(currency || "AUD").toUpperCase()}`;
}

export function peopleCacheKey(userId) {
  return `people:${String(userId)}:list`;
}

export function transactionListCacheKey(userId, queryString = "") {
  return `transactions:list:${String(userId)}:${encodeKeyPart(queryString)}`;
}

export function transactionDataCacheKey(userId, queryString = "") {
  return `transactions:data:${String(userId)}:${encodeKeyPart(queryString)}`;
}

export function notificationsCacheKey(userId) {
  return `notifications:${String(userId)}:list`;
}

/** GET /api/notifications?scope=community — post/thread activity only. */
export function communityPostNotificationsCacheKey(userId) {
  return `notifications:${String(userId)}:community_posts`;
}

export function cardsCacheKey(userId) {
  return `cards:${String(userId)}:list`;
}

export function filesCacheKey(userId, queryString = "", origin = "") {
  return `files:${String(userId)}:${encodeKeyPart(origin)}:${encodeKeyPart(queryString)}`;
}

/** Community feed list (GET /api/community/posts) — viewer-specific for like flags. */
export function communityFeedCacheKey(filter, cursor, viewerId) {
  return `community:feed:v1:${encodeKeyPart(filter)}:${encodeKeyPart(cursor || "")}:${encodeKeyPart(viewerId || "anon")}`;
}

/** Personalized first-page cache for community feed. */
export function communityPersonalizedFeedCacheKey(viewerId) {
  return `community:feed:personalized:v1:${encodeKeyPart(viewerId || "anon")}`;
}

/** Thread for one post (GET .../comments) — includes viewer id for future personalization. */
export function communityCommentsCacheKey(postId, viewerId) {
  return `community:comments:v1:${encodeKeyPart(postId)}:${encodeKeyPart(viewerId || "anon")}`;
}

/** Aggregated trending topics (GET /api/community/trending). */
export function communityTrendingCacheKey(limit = 10) {
  return `community:trending:v2:${encodeKeyPart(String(limit))}`;
}

/** Drop cached trending aggregates only (scan). */
export async function clearCommunityTrendingCache() {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    const keysToDelete = new Set();
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(cursor, { match: "community:trending:*", count: 100 });
      cursor = String(nextCursor);
      for (const key of keys || []) {
        keysToDelete.add(String(key));
      }
    } while (cursor !== "0");

    if (keysToDelete.size > 0) {
      await client.del(...Array.from(keysToDelete));
    }
    return true;
  } catch (error) {
    handleRedisError("Redis trending cache clear failed", error);
    return false;
  }
}

/** Invalidate cached community feeds and comment threads (after writes). */
export async function clearCommunityCaches() {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    const { enqueueCacheInvalidation } = await import("@/lib/queue/producers");
    const queued = await enqueueCacheInvalidation("clear-community-cache", {});
    if (queued) return true;

    const patterns = ["community:feed:v1:*", "community:feed:personalized:v1:*", "community:comments:v1:*", "community:trending:*"];
    const keysToDelete = new Set();
    for (const pattern of patterns) {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await client.scan(cursor, { match: pattern, count: 100 });
        cursor = String(nextCursor);
        for (const key of keys || []) {
          keysToDelete.add(String(key));
        }
      } while (cursor !== "0");
    }

    if (keysToDelete.size > 0) {
      await client.del(...Array.from(keysToDelete));
    }
    return true;
  } catch (error) {
    handleRedisError("Redis community cache clear failed", error);
    return false;
  }
}

export async function publishNotificationEvent(userId, type = "changed") {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    await client.publish(
      NOTIFICATION_CHANNEL,
      JSON.stringify({
        userId: String(userId),
        type,
        at: new Date().toISOString(),
      })
    );
    return true;
  } catch (error) {
    handleRedisError("Redis publish notification event failed", error);
    return false;
  }
}

export async function clearUserApiCache(userId) {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    const userIdText = String(userId);
    const quickKeys = [
      `dashboard:${userIdText}`,
      `people:${userIdText}`,
      `transactions:${userIdText}`,
      `notifications:${userIdText}`,
      `cards:${userIdText}`,
      `files:${userIdText}`,
      `people:${userIdText}:list`,
      `notifications:${userIdText}:list`,
      `cards:${userIdText}:list`,
      `dashboard:${userIdText}:AUD`,
      `dashboard:${userIdText}:USD`,
      `dashboard:${userIdText}:INR`,
      `dashboard:${userIdText}:EUR`,
      `dashboard:${userIdText}:GBP`,
    ];
    await client.del(...quickKeys);

    const { enqueueCacheInvalidation } = await import("@/lib/queue/producers");
    const queued = await enqueueCacheInvalidation("clear-user-cache", { userId: userIdText });
    if (queued) return true;

    const patterns = [
      `dashboard:${userIdText}:*`,
      `people:${userIdText}:*`,
      `transactions:list:${userIdText}:*`,
      `transactions:data:${userIdText}:*`,
      `notifications:${userIdText}:*`,
      `cards:${userIdText}:*`,
      `files:${userIdText}:*`,
    ];

    const keysToDelete = new Set();
    for (const pattern of patterns) {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await client.scan(cursor, { match: pattern, count: 100 });
        cursor = String(nextCursor);
        for (const key of keys || []) {
          keysToDelete.add(String(key));
        }
      } while (cursor !== "0");
    }

    if (keysToDelete.size > 0) {
      await client.del(...Array.from(keysToDelete));
    }

    return true;
  } catch (error) {
    handleRedisError("Redis user cache clear failed", error);
    return false;
  }
}

export async function clearDashboardCache(userId) {
  return clearUserApiCache(userId);
}
