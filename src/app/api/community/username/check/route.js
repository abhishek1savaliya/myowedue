import { fail, ok } from "@/lib/api";
import { checkCommunityHandleAvailability } from "@/lib/community-handle-availability";
import { COMMUNITY_USERNAME_MAX, COMMUNITY_USERNAME_MIN } from "@/lib/community-usernames";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { requireUser } from "@/lib/session";
import { isCommunityConfigured } from "@/lib/community-server";

/**
 * GET ?q=proposed — live uniqueness check for community username (authenticated).
 * Returns availability without reserving the name.
 */
export async function GET(request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  if (!isCommunityConfigured()) {
    return ok({
      configured: false,
      status: "unconfigured",
      available: null,
      min: COMMUNITY_USERNAME_MIN,
      max: COMMUNITY_USERNAME_MAX,
    });
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("q") ?? searchParams.get("username") ?? "";
  const s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");

  const baseMeta = {
    configured: true,
    min: COMMUNITY_USERNAME_MIN,
    max: COMMUNITY_USERNAME_MAX,
  };

  const result = await checkCommunityHandleAvailability(s, user._id);

  if (result.status === "error") {
    const mapped = mapCommunitySupabaseError(result.error, setup);
    if (mapped) return fail(mapped, 503);
    return fail(result.error || "Lookup failed", 500);
  }

  return ok({ ...baseMeta, ...result });
}
