"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COMMUNITY_MUTATE_EVENT } from "@/lib/community-mutate-event";

const FETCH_LIMIT = 10;

/**
 * Shared trending topics for community shell (one fetch, slice for left vs right rails).
 * @returns {{ topics: Array<{ topic: string; total_posts: number; trend_score: number }>; loading: boolean; refresh: () => void }}
 */
export function useCommunityTrending() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch(`/api/community/trending?limit=${FETCH_LIMIT}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTopics([]);
        return;
      }
      setTopics(Array.isArray(data.topics) ? data.topics : []);
    } catch {
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleRefetch = useCallback(() => {
    if (typeof window === "undefined") return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void fetchTrending();
    }, 450);
  }, [fetchTrending]);

  useEffect(() => {
    void fetchTrending();
  }, [fetchTrending]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = () => scheduleRefetch();
    window.addEventListener(COMMUNITY_MUTATE_EVENT, handler);
    return () => {
      window.removeEventListener(COMMUNITY_MUTATE_EVENT, handler);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [scheduleRefetch]);

  return { topics, loading, refresh: fetchTrending };
}
