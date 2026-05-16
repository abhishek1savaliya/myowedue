export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startReminderCron } = await import("@/lib/cron");
  startReminderCron();
}
