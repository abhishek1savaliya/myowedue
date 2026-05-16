import { sendMail } from "@/lib/mailer";

export const EMAIL_QUEUE_NAME = "email";
export const EMAIL_CONCURRENCY = 5;

export async function emailProcessor(job) {
  const { to, subject, headline, message } = job.data;
  if (!to) throw new Error("Missing recipient email");

  const result = await sendMail({ to, subject, headline, message });
  if (!result.ok) throw new Error(result.message || "Email send failed");
  return { sent: true, to };
}
import "server-only";
