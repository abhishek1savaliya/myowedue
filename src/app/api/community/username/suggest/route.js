import { fail, ok } from "@/lib/api";
import { searchCommunityMembers } from "@/lib/community-member-search";
import { COMMUNITY_USERNAME_MAX, normalizeSavedUsernameHandle } from "@/lib/community-usernames";
import { prepareCommunityApi } from "@/lib/community-api-setup";
import { isSupabaseCommunityConfigured } from "@/lib/supabase-server";

const DEFAULT_LIMIT = 12;

/**
 * GET ?q= — public prefix search over community_usernames (autocomplete).
 */
export async function GET(request) {
  if (!isSupabaseCommunityConfigured()) {
    return ok({ matches: [] });
  }

  const { fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("q") ?? "";
  const prefix = normalizeSavedUsernameHandle(raw).replace(/[^a-z0-9_]/g, "");

  if (prefix.length < 1 || prefix.length > COMMUNITY_USERNAME_MAX) {
    return ok({ matches: [], results: [] });
  }

  const results = await searchCommunityMembers(raw, DEFAULT_LIMIT);
  const matches = results.map((r) => r.username).filter(Boolean);

  return ok({ matches, results });
}
