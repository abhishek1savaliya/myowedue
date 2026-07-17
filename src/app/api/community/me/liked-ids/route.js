import { fail, ok } from "@/lib/api";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { fetchLikedPostIdsByUser, isCommunityDbConfigured } from "@/lib/community-db";
import { getSessionUser } from "@/lib/session";
import { isCommunityConfigured } from "@/lib/community-server";

export const dynamic = "force-dynamic";

/**
 * Lightweight list of post ids the signed-in user has liked.
 * Used by the feed client to paint red hearts after refresh (SEO seed / Redis cannot be trusted alone).
 */
export async function GET(request) {
  if (!isCommunityConfigured() || !isCommunityDbConfigured()) {
    return fail("Community unavailable.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const user = await getSessionUser(request);
  if (!user) return ok({ ids: [], currentUserId: "" });

  const currentUserId = String(user._id);
  try {
    const rows = await fetchLikedPostIdsByUser(currentUserId, 500);
    const ids = (rows || []).map((r) => String(r.post_id)).filter(Boolean);
    return ok({ ids, currentUserId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Failed to load likes", 500);
  }
}
