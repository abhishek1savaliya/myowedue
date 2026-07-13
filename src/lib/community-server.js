import { isCommunityDbConfigured } from "@/lib/community-db";
import { prepareCommunityPostgresSchema } from "@/lib/community-postgres";

export function isCommunityConfigured() {
  return isCommunityDbConfigured();
}

/** @deprecated Use isCommunityConfigured */
export const isSupabaseCommunityConfigured = isCommunityConfigured;

export async function ensureCommunityPostgresSchema() {
  if (!isCommunityConfigured()) return undefined;
  return prepareCommunityPostgresSchema();
}

export { prepareCommunityPostgresSchema, resetCommunityPostgresBootstrap } from "@/lib/community-postgres";
