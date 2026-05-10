/**
 * Supabase PostgREST errors when tables are missing or schema cache is stale.
 */
export function isCommunitySchemaOrTableError(message) {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("schema cache") ||
    m.includes("pgrst204") ||
    m.includes("pgrst205") ||
    (m.includes("community_posts") && (m.includes("not find") || m.includes("could not find"))) ||
    (m.includes("community_post_shares") && (m.includes("not find") || m.includes("could not find"))) ||
    (m.includes("relation") && m.includes("does not exist"))
  );
}

/**
 * User-facing message when PostgREST cannot read/write community tables.
 * @param {string|undefined} supabaseMsg
 * @param {{ skipped?: boolean; ok?: boolean; error?: string; existed?: boolean; created?: boolean }} bootstrap - from ensureCommunityPostgresSchema / prepareCommunityPostgresSchema
 * @param {boolean} hasDirectPostgresUrl - SUPABASE_DATABASE_URL is set
 */
export function communitySupabaseFailMessage(supabaseMsg, bootstrap, hasDirectPostgresUrl) {
  if (!isCommunitySchemaOrTableError(supabaseMsg)) return null;

  if (bootstrap?.ok === false && bootstrap?.error) {
    const err = String(bootstrap.error);
    const el = err.toLowerCase();
    const poolerHint =
      hasDirectPostgresUrl && (err.includes("6543") || el.includes("prepared statement"))
        ? " Use Session mode on port 5432 (or the “Direct connection” host from Supabase → Database), not the transaction pooler on 6543, for running migrations."
        : hasDirectPostgresUrl && el.includes("pooler")
          ? " Try the Session pooler (port 5432) or direct db.<project>.supabase.co:5432 connection string."
          : "";

    const timeoutHint =
      hasDirectPostgresUrl && /timeout|etimedout|econnrefused|enotfound|connection terminated/i.test(err)
        ? " Confirm SUPABASE_DATABASE_URL is the Postgres URI (starts with postgres://) from Supabase → Database → Connection string, not the https:// API URL. Use Session (5432) or Direct; allow outbound TCP 5432 (VPN/firewall). Or run 001_community.sql in the SQL Editor instead."
        : "";

    return `Could not create community tables via Postgres: ${err}.${poolerHint}${timeoutHint} You can instead open Supabase → SQL Editor and run supabase/migrations/001_community.sql manually.`;
  }

  if (bootstrap?.skipped && !hasDirectPostgresUrl) {
    return (
      "Community tables are missing for this Supabase project (Posts use Postgres; the rest of the app uses MongoDB). " +
      "Open Supabase Dashboard → SQL → New query, paste the full contents of supabase/migrations/001_community.sql from your repo, click Run, then refresh this page. " +
      "Optional: add SUPABASE_DATABASE_URL (Session mode, port 5432, from Database → Connection string) to .env.local so tables can be created automatically on first request."
    );
  }

  if (hasDirectPostgresUrl && (bootstrap?.created || bootstrap?.existed || bootstrap?.ok)) {
    return (
      "Supabase API has not picked up the community tables yet. Wait 30–60 seconds, refresh, or run in the SQL Editor: NOTIFY pgrst, 'reload schema';"
    );
  }

  return (
    "Community data is not available. Run supabase/migrations/001_community.sql in the Supabase SQL Editor for the same project as NEXT_PUBLIC_SUPABASE_URL, then refresh."
  );
}
