import IORedis from "ioredis";

let _connection = null;

export function getQueueConnection() {
  if (_connection) return _connection;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  _connection = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  _connection.on("error", (err) => {
    console.error("[BullMQ] Redis connection error:", err.message);
  });

  return _connection;
}

export function isQueueRedisConfigured() {
  return Boolean(process.env.REDIS_URL);
}
