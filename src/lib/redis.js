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

export function dashboardCacheKey(userId, currency = "AUD") {
  return `dashboard:${String(userId)}:${String(currency || "AUD").toUpperCase()}`;
}

export async function clearDashboardCache(userId) {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    const pattern = `dashboard:${String(userId)}:*`;
    const keys = [];
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }

    if (keys.length > 0) {
      await client.del(keys);
    }

    // Cleanup legacy single-key cache if present.
    await client.del(`dashboard:${String(userId)}`);
    return true;
  } catch (error) {
    console.error("Redis dashboard cache clear failed:", error?.message || error);
    return false;
  }
}
