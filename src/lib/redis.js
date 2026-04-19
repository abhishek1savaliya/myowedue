import { createClient } from "redis";

let clientPromise = null;

function hasRedisUrl() {
  return Boolean(process.env.REDIS_URL);
}

async function createRedisClient() {
  const client = createClient({ url: process.env.REDIS_URL });

  client.on("error", (error) => {
    console.error("Redis error:", error?.message || error);
  });

  await client.connect();
  return client;
}

export async function getRedisClient() {
  if (!hasRedisUrl()) return null;

  if (!clientPromise) {
    clientPromise = createRedisClient().catch((error) => {
      clientPromise = null;
      console.error("Redis connect failed:", error?.message || error);
      return null;
    });
  }

  return clientPromise;
}

export async function getRedisJSON(key) {
  try {
    const client = await getRedisClient();
    if (!client) return null;

    const value = await client.get(key);
    if (!value) return null;

    return JSON.parse(value);
  } catch (error) {
    console.error("Redis get failed:", error?.message || error);
    return null;
  }
}

export async function setRedisJSON(key, data, ttlSeconds = 120) {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    await client.set(key, JSON.stringify(data), { EX: ttlSeconds });
    return true;
  } catch (error) {
    console.error("Redis set failed:", error?.message || error);
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
    console.error("Redis delete failed:", error?.message || error);
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
      "notifications:events",
      JSON.stringify({
        userId: String(userId),
        type,
        at: new Date().toISOString(),
      })
    );
    return true;
  } catch (error) {
    console.error("Redis publish notification event failed:", error?.message || error);
    return false;
  }
}

export async function clearUserApiCache(userId) {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    const userIdText = String(userId);
    const patterns = [
      `dashboard:${userIdText}:*`,
      `people:${userIdText}:*`,
      `transactions:list:${userIdText}:*`,
      `transactions:data:${userIdText}:*`,
      `notifications:${userIdText}:*`,
    ];

    const keys = [];
    for (const pattern of patterns) {
      for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        keys.push(String(key));
      }
    }

    if (keys.length > 0) {
      await client.del(...keys);
    }

    // Cleanup legacy single-key cache formats if present.
    await client.del(`dashboard:${userIdText}`);
    await client.del(`people:${userIdText}`);
    await client.del(`transactions:${userIdText}`);
    await client.del(`notifications:${userIdText}`);
    return true;
  } catch (error) {
    console.error("Redis user cache clear failed:", error?.message || error);
    return false;
  }
}

export async function clearDashboardCache(userId) {
  return clearUserApiCache(userId);
}
