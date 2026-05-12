import "dotenv/config";
import { Worker } from "bullmq";
import { getQueueConnection, isQueueRedisConfigured } from "./src/lib/queue/connection.js";

if (!isQueueRedisConfigured()) {
  console.error("[worker] REDIS_URL is not set. Cannot start workers.");
  process.exit(1);
}

const connection = getQueueConnection();
const workers = [];

async function startWorkers() {
  const { emailProcessor, EMAIL_QUEUE_NAME, EMAIL_CONCURRENCY } = await import(
    "./src/lib/queue/workers/email.worker.js"
  );
  workers.push(
    new Worker(EMAIL_QUEUE_NAME, emailProcessor, { connection, concurrency: EMAIL_CONCURRENCY })
  );

  const { pdfProcessor, PDF_QUEUE_NAME, PDF_CONCURRENCY } = await import(
    "./src/lib/queue/workers/pdf.worker.js"
  );
  workers.push(
    new Worker(PDF_QUEUE_NAME, pdfProcessor, { connection, concurrency: PDF_CONCURRENCY })
  );

  const { cronProcessor, CRON_QUEUE_NAME, CRON_CONCURRENCY } = await import(
    "./src/lib/queue/workers/cron.worker.js"
  );
  workers.push(
    new Worker(CRON_QUEUE_NAME, cronProcessor, { connection, concurrency: CRON_CONCURRENCY })
  );

  const { communityProcessor, COMMUNITY_QUEUE_NAME, COMMUNITY_CONCURRENCY } = await import(
    "./src/lib/queue/workers/community.worker.js"
  );
  workers.push(
    new Worker(COMMUNITY_QUEUE_NAME, communityProcessor, {
      connection,
      concurrency: COMMUNITY_CONCURRENCY,
    })
  );

  const { fileOpsProcessor, FILEOPS_QUEUE_NAME, FILEOPS_CONCURRENCY } = await import(
    "./src/lib/queue/workers/fileOps.worker.js"
  );
  workers.push(
    new Worker(FILEOPS_QUEUE_NAME, fileOpsProcessor, {
      connection,
      concurrency: FILEOPS_CONCURRENCY,
    })
  );

  const { cacheProcessor, CACHE_QUEUE_NAME, CACHE_CONCURRENCY } = await import(
    "./src/lib/queue/workers/cache.worker.js"
  );
  workers.push(
    new Worker(CACHE_QUEUE_NAME, cacheProcessor, { connection, concurrency: CACHE_CONCURRENCY })
  );

  for (const w of workers) {
    w.on("completed", (job) => {
      console.log(`[${w.name}] Job ${job.id} completed`);
    });
    w.on("failed", (job, err) => {
      console.error(`[${w.name}] Job ${job?.id} failed:`, err.message);
    });
  }

  console.log(`[worker] Started ${workers.length} workers: ${workers.map((w) => w.name).join(", ")}`);
}

async function shutdown() {
  console.log("[worker] Shutting down...");
  await Promise.all(workers.map((w) => w.close()));
  console.log("[worker] All workers closed.");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

startWorkers().catch((err) => {
  console.error("[worker] Failed to start:", err);
  process.exit(1);
});
