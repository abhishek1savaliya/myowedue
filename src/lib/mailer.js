import { Resend } from "resend";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export async function sendMail({ to, subject, headline, message }) {
  const resend = getResendClient();
  if (!resend) {
    return { ok: false, message: "Resend is not configured (missing RESEND_API_KEY)" };
  }

  const from = process.env.RESEND_FROM || "onboarding@resend.dev";
  const html = `
    <div style="font-family: Helvetica, Arial, sans-serif; background: #fff; color: #111; padding: 24px; border: 1px solid #d4d4d4;">
      <h2 style="margin: 0 0 12px; font-size: 20px; letter-spacing: 0.02em;">${headline}</h2>
      <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6;">${message}</p>
      <p style="margin: 0; font-size: 12px; color: #525252;">Sent from Personal Credit/Debit Manager</p>
    </div>
  `;

  await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  return { ok: true };
}
