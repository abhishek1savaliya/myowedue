import { fail, ok } from "@/lib/api";
import { lookupCommunityUsernameInAlgolia } from "@/lib/community-algolia";
import {
  COMMUNITY_USERNAME_MAX,
  COMMUNITY_USERNAME_MIN,
  RESERVED_COMMUNITY_USERNAMES,
} from "@/lib/community-usernames";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";

/**
 * GET ?q= — public availability check for sign-up (no session).
 * If a row exists for the username, it is taken (no "yours" branch).
 */
export async function GET(request) {
  if (!isSupabaseCommunityConfigured()) {
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

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return ok({
      configured: false,
      status: "unconfigured",
      available: null,
      min: COMMUNITY_USERNAME_MIN,
      max: COMMUNITY_USERNAME_MAX,
    });
  }

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

  if (s.length === 0) {
    return ok({ ...baseMeta, status: "empty", available: null, normalized: "" });
  }

  if (!/^[a-z0-9_]+$/.test(s)) {
    return ok({ ...baseMeta, status: "invalid_chars", available: false, normalized: s });
  }

  if (s.length < COMMUNITY_USERNAME_MIN) {
    return ok({
      ...baseMeta,
      status: "short",
      available: false,
      normalized: s,
      needed: COMMUNITY_USERNAME_MIN - s.length,
    });
  }

  if (s.length > COMMUNITY_USERNAME_MAX) {
    return ok({ ...baseMeta, status: "long", available: false, normalized: s });
  }

  if (RESERVED_COMMUNITY_USERNAMES.has(s)) {
    return ok({ ...baseMeta, status: "reserved", available: false, normalized: s });
  }

  // Fast path via Algolia.
  const algoliaHit = await lookupCommunityUsernameInAlgolia(s);
  if (algoliaHit?.userId) {
    return ok({ ...baseMeta, status: "taken", available: false, normalized: s });
  }

  const { data: row, error: qErr } = await supabase
    .from("community_usernames")
    .select("user_id")
    .eq("username", s)
    .maybeSingle();

  if (qErr) {
    const mapped = mapCommunitySupabaseError(qErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(qErr.message || "Lookup failed", 500);
  }

  if (!row) {
    return ok({ ...baseMeta, status: "available", available: true, normalized: s });
  }

  return ok({ ...baseMeta, status: "taken", available: false, normalized: s });
}
