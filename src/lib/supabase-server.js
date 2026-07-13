/**
 * @deprecated Import from @/lib/community-server instead.
 * Kept for backwards compatibility during Neon migration.
 */
export {
  isCommunityConfigured as isSupabaseCommunityConfigured,
  ensureCommunityPostgresSchema,
  prepareCommunityPostgresSchema,
  resetCommunityPostgresBootstrap,
} from "@/lib/community-server";
