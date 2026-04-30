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
    // Fast path: clear known hot keys immediately to reduce write latency.
    const quickKeys = [
      `dashboard:${userIdText}`,
      `people:${userIdText}`,
      `transactions:${userIdText}`,
      `notifications:${userIdText}`,
      `people:${userIdText}:list`,
      `notifications:${userIdText}:list`,
      `dashboard:${userIdText}:AUD`,
      `dashboard:${userIdText}:USD`,
      `dashboard:${userIdText}:INR`,
      `dashboard:${userIdText}:EUR`,
      `dashboard:${userIdText}:GBP`,
    ];
    await client.del(...quickKeys);

    const patterns = [
      `dashboard:${userIdText}:*`,
      `people:${userIdText}:*`,
      `transactions:list:${userIdText}:*`,
      `transactions:data:${userIdText}:*`,
      `notifications:${userIdText}:*`,
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
