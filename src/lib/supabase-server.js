import { createClient } from "@supabase/supabase-js";
import { getSupabaseProjectUrl, getSupabaseSecretKey, isSupabaseCommunityEnvComplete } from "@/lib/supabase-env";
import { prepareCommunityPostgresSchema } from "@/lib/community-postgres";

let adminClient;

/**
 * Server-only Supabase client with the secret / service role key (bypasses RLS).
 * Community writes must go through Next.js API routes after session checks.
 */
export function getSupabaseAdmin() {
  if (adminClient) return adminClient;

  const url = getSupabaseProjectUrl();
  const secretKey = getSupabaseSecretKey();

  if (!url || !secretKey) {
    return null;
  }

  adminClient = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export function isSupabaseCommunityConfigured() {
  return isSupabaseCommunityEnvComplete();
}

/**
 * Ensures community tables exist when SUPABASE_DATABASE_URL is set.
 * @returns {Promise<{ skipped?: boolean; ok?: boolean; existed?: boolean; created?: boolean; error?: string } | undefined>}
 */
export async function ensureCommunityPostgresSchema() {
  if (!isSupabaseCommunityConfigured()) return undefined;
  return prepareCommunityPostgresSchema();
}

export { prepareCommunityPostgresSchema, resetCommunityPostgresBootstrap } from "@/lib/community-postgres";
