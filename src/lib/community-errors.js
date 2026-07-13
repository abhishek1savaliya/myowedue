/**
 * Postgres errors when community tables are missing.
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
 * User-facing message when Postgres cannot read/write community tables.
 * @param {string|undefined} dbMsg
 * @param {{ skipped?: boolean; ok?: boolean; error?: string; existed?: boolean; created?: boolean }} bootstrap
 * @param {boolean} hasDirectPostgresUrl - NEON_DATABASE_URL / COMMUNITY_DATABASE_URL is set
 */
export function communitySupabaseFailMessage(dbMsg, bootstrap, hasDirectPostgresUrl) {
  if (!isCommunitySchemaOrTableError(dbMsg)) return null;

  if (bootstrap?.ok === false && bootstrap?.error) {
    const err = String(bootstrap.error);
    const timeoutHint =
      hasDirectPostgresUrl && /timeout|etimedout|econnrefused|enotfound|connection terminated/i.test(err)
        ? " Confirm NEON_DATABASE_URL or COMMUNITY_DATABASE_URL is a valid Postgres URI from Neon. Use the direct (non-pooler) host for DDL if migrations fail."
        : "";

    return `Could not create community tables via Postgres: ${err}.${timeoutHint} You can run supabase/migrations/001_community.sql through 011 on your Neon database instead.`;
  }

  if (bootstrap?.skipped && !hasDirectPostgresUrl) {
    return (
      "Community tables are missing (Posts use Neon Postgres; the rest of the app uses MongoDB). " +
      "Add NEON_DATABASE_URL to .env.local, or run supabase/migrations/001_community.sql through 011 on your Neon database."
    );
  }

  return (
    "Community data is not available. Add NEON_DATABASE_URL to .env.local or run supabase/migrations on your Neon database, then refresh."
  );
}
