/**
 * Keep this hook free of mongoose, bullmq, and node-cron so Next can compile
 * instrumentation for all runtimes.
 *
 * Scheduled jobs run in the BullMQ worker when ENABLE_CRON=true (`npm run worker`).
 */
export async function register() {}
