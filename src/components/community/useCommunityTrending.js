"use client";

import { useEffect } from "react";
import { useCommunityTrendingStore } from "@/stores/useCommunityTrendingStore";

/**
 * Shared trending topics for community shell (Zustand: one fetch for all rails).
 * @returns {{ topics: Array<{ topic: string; total_posts: number; trend_score: number }>; loading: boolean; refresh: () => void }}
 */
export function useCommunityTrending() {
  const topics = useCommunityTrendingStore((s) => s.topics);
  const loading = useCommunityTrendingStore((s) => s.loading);
  const refresh = useCommunityTrendingStore((s) => s.refresh);
  const bootstrap = useCommunityTrendingStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return { topics, loading, refresh };
}
