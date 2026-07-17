import { getRedisClient } from "@/lib/redis";

export const CACHE_QUEUE_NAME = "cache-invalidation";
export const CACHE_CONCURRENCY = 10;

export async function cacheProcessor(job) {
  switch (job.name) {
    case "clear-user-cache":
      return handleClearUserCache(job.data);
    case "clear-community-cache":
      return handleClearCommunityCache(job.data);
    default:
      throw new Error(`Unknown cache job: ${job.name}`);
  }
}

async function scanAndDelete(client, patterns) {
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
  return keysToDelete.size;
}

async function handleClearUserCache({ userId }) {
  const client = await getRedisClient();
  if (!client) return { skipped: true };

  const userIdText = String(userId);
  const patterns = [
    `dashboard:${userIdText}:*`,
    `people:${userIdText}:*`,
    `transactions:list:${userIdText}:*`,
    `transactions:data:${userIdText}:*`,
    `notifications:${userIdText}:*`,
    `cards:${userIdText}:*`,
    `files:${userIdText}:*`,
  ];

  const deleted = await scanAndDelete(client, patterns);
  return { deleted };
}

async function handleClearCommunityCache() {
  const client = await getRedisClient();
  if (!client) return { skipped: true };

  // Feed/post list caches are invalidated via generation bump in clearCommunityCaches.
  // Worker only needs to drop non-generation-scoped + legacy keys.
  const patterns = [
    "community:comments:v1:*",
    "community:trending:*",
    "community:suggested_creators:*",
    "community:feed:v1:*",
    "community:feed:topic:v1:*",
    "community:feed:personalized:v1:*",
  ];

  const deleted = await scanAndDelete(client, patterns);
  return { deleted };
}
import "server-only";
