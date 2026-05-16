import { fail, ok } from "@/lib/api";
import { isValidPremiumFunnelEventType, recordPremiumFunnelEvent } from "@/lib/premium-funnel";
import { requireUser } from "@/lib/session";

export async function POST(req) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const body = await req.json().catch(() => ({}));
    const eventType = String(body.eventType || "").trim();

    if (!isValidPremiumFunnelEventType(eventType)) {
      return fail("Invalid event type", 400);
    }

    await recordPremiumFunnelEvent(user._id, {
      eventType,
      source: body.source,
      path: body.path,
      meta: body.meta,
    });

    return ok({ recorded: true });
  } catch (err) {
    console.error("Premium funnel track error:", err);
    return fail("Could not record event", 500);
  }
}
