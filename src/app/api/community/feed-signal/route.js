import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { isCommunityConfigured } from "@/lib/community-server";
import { insertFeedSignal, isCommunityDbConfigured } from "@/lib/community-db";

const ALLOWED_EVENTS = new Set(["view", "open", "like", "comment", "share", "save"]);

export async function POST(request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  if (!isCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  if (!isCommunityDbConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const postId = String(body.postId || "").trim();
  const eventType = String(body.eventType || "view").trim().toLowerCase();
  const watch = Math.max(0, Math.min(300000, Number(body.watchTimeMs || 0)));
  const scroll = Math.max(0, Math.min(300000, Number(body.scrollDurationMs || 0)));
  const dwell = Math.max(0, Math.min(300000, Number(body.dwellMs || 0)));

  if (!postId) return fail("postId is required", 422);
  if (!ALLOWED_EVENTS.has(eventType)) return fail("Invalid eventType", 422);

  try {
    await insertFeedSignal({
      user_id: String(user._id),
      post_id: postId,
      event_type: eventType,
      watch_time_ms: watch,
      scroll_duration_ms: scroll,
      dwell_ms: dwell,
    });
  } catch (insErr) {
    const message = insErr instanceof Error ? insErr.message : String(insErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Failed to save signal", 500);
  }

  return ok({ saved: true });
}
