import "server-only";
import { Queue } from "bullmq";
import { getQueueConnection, isQueueRedisConfigured } from "./connection.js";

const _queues = new Map();

function getOrCreateQueue(name, opts = {}) {
  if (!isQueueRedisConfigured()) return null;

  if (_queues.has(name)) return _queues.get(name);

  const connection = getQueueConnection();
  if (!connection) return null;

  const queue = new Queue(name, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
      ...opts,
    },
  });

  _queues.set(name, queue);
  return queue;
}

export function getEmailQueue() {
  return getOrCreateQueue("email", {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
}

export function getPdfQueue() {
  return getOrCreateQueue("pdf-generation", {
    attempts: 1,
  });
}

export function getCronFanoutQueue() {
  return getOrCreateQueue("cron-fanout", {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
  });
}

export function getCommunityQueue() {
  return getOrCreateQueue("community-jobs", {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
  });
}

export function getFileOpsQueue() {
  return getOrCreateQueue("file-ops", {
    attempts: 2,
    backoff: { type: "exponential", delay: 2000 },
  });
}

export function getCacheQueue() {
  return getOrCreateQueue("cache-invalidation", {
    attempts: 1,
  });
}
