import { communitySupabaseFailMessage } from "@/lib/community-errors";
import { getCommunityDatabaseUrl } from "@/lib/community-env";
import { ensureCommunityPostgresSchema } from "@/lib/community-server";

export function hasDirectPostgresUrl() {
  return Boolean(getCommunityDatabaseUrl());
}

/**
 * Runs optional Postgres DDL bootstrap, returns 503 message if bootstrap failed hard.
 * @returns {Promise<{ setup: object; fail503?: string }>}
 */
export async function prepareCommunityApi() {
  const setup = (await ensureCommunityPostgresSchema()) || {};
  if (setup.ok === false && setup.error) {
    const msg = communitySupabaseFailMessage(
      "Could not find the table 'public.community_posts' in the schema cache",
      setup,
      hasDirectPostgresUrl()
    );
    return { setup, fail503: msg || setup.error };
  }
  return { setup };
}

export function mapCommunitySupabaseError(message, setup) {
  return communitySupabaseFailMessage(message, setup, hasDirectPostgresUrl());
}
