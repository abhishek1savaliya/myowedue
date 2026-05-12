import { fail, ok } from "@/lib/api";
import { getRedisJSON } from "@/lib/redis";
import { getPdfQueue } from "@/lib/queue/queues";

export async function GET(request, { params }) {
  const { id } = await params;
  if (!id) return fail("Job ID required", 400);

  const queue = getPdfQueue();
  if (!queue) return fail("Queue unavailable", 503);

  try {
    const job = await queue.getJob(id);
    if (!job) return fail("Job not found", 404);

    const state = await job.getState();

    if (state === "completed") {
      const cached = await getRedisJSON(`pdf-result:${id}`);
      if (cached?.base64) {
        return ok({
          status: "completed",
          progress: 100,
          result: { base64: cached.base64, contentType: cached.contentType || "application/pdf" },
        });
      }
      return ok({ status: "completed", progress: 100, result: null });
    }

    if (state === "failed") {
      return ok({
        status: "failed",
        progress: 0,
        error: job.failedReason || "Job failed",
      });
    }

    return ok({
      status: state,
      progress: job.progress || 0,
    });
  } catch {
    return fail("Failed to check job status", 500);
  }
}
