"use client";

import TrendingTopicsCard from "@/components/community/TrendingTopicsCard";
import { useCommunityTrending } from "@/components/community/useCommunityTrending";
import { useUserStore } from "@/stores/useUserStore";

/**
 * Self-contained trending list (fetches `/api/community/trending` once per mount).
 * @param {{ limit?: number; variant?: "shell" | "portal"; className?: string; linkBasePath?: string | null }} props
 */
export default function TrendingTopicsFromApi({
  limit = 10,
  variant = "shell",
  className = "",
  linkBasePath = "/community",
}) {
  const { topics, loading } = useCommunityTrending();
  const isPremium = Boolean(useUserStore((s) => s.user?.isPremium));
  return (
    <TrendingTopicsCard
      topics={topics}
      loading={loading}
      limit={limit}
      variant={variant}
      className={className}
      linkBasePath={linkBasePath}
      isPremium={isPremium}
    />
  );
}
