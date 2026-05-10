import { fail, ok } from "@/lib/api";
import { COMMUNITY_USERNAME_MAX, normalizeSavedUsernameHandle } from "@/lib/community-usernames";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";

const DEFAULT_LIMIT = 12;

/**
 * GET ?q= — public prefix search over community_usernames (autocomplete).
 */
export async function GET(request) {
  if (!isSupabaseCommunityConfigured()) {
    return ok({ matches: [] });
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return ok({ matches: [] });
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("q") ?? "";
  const prefix = normalizeSavedUsernameHandle(raw).replace(/[^a-z0-9_]/g, "");

  if (prefix.length < 1 || prefix.length > COMMUNITY_USERNAME_MAX) {
    return ok({ matches: [] });
  }

  const { data, error } = await supabase.rpc("community_username_suggest", {
    prefix,
    lim: DEFAULT_LIMIT,
  });

  if (error) {
    const mapped = mapCommunitySupabaseError(error.message, setup);
    if (mapped) return fail(mapped, 503);
    console.warn("[community] username suggest rpc:", error.message);
    return ok({ matches: [] });
  }

  const rows = Array.isArray(data) ? data : [];
  const matches = rows
    .map((row) => (row && typeof row.username === "string" ? row.username : ""))
    .filter(Boolean);

  return ok({ matches });
}
