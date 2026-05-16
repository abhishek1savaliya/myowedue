import "server-only";
import { getEmailQueue, getPdfQueue, getCronFanoutQueue, getCommunityQueue, getFileOpsQueue, getCacheQueue } from "./queues.js";
import { sendMail } from "@/lib/mailer";

export async function enqueueEmail(data) {
  try {
    const queue = getEmailQueue();
    if (!queue) throw new Error("Queue unavailable");
    await queue.add("send", data);
    return true;
  } catch {
    await sendMail(data).catch(() => {});
    return false;
  }
}

export async function enqueuePdf(jobName, data) {
  try {
    const queue = getPdfQueue();
    if (!queue) return null;
    const job = await queue.add(jobName, data);
    return job.id;
  } catch {
    return null;
  }
}

export async function enqueueCronJob(jobName, data) {
  try {
    const queue = getCronFanoutQueue();
    if (!queue) return false;
    await queue.add(jobName, data);
    return true;
  } catch {
    return false;
  }
}

export async function enqueueCommunityJob(jobName, data) {
  try {
    const queue = getCommunityQueue();
    if (!queue) return false;
    await queue.add(jobName, data);
    return true;
  } catch {
    return false;
  }
}

export async function enqueueFileOps(jobName, data) {
  try {
    const queue = getFileOpsQueue();
    if (!queue) return false;
    await queue.add(jobName, data);
    return true;
  } catch {
    return false;
  }
}

export async function enqueueCacheInvalidation(jobName, data) {
  try {
    const queue = getCacheQueue();
    if (!queue) return false;
    await queue.add(jobName, data);
    return true;
  } catch {
    return false;
  }
}
