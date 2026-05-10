"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { COMMUNITY_MUTATE_EVENT } from "@/lib/community-mutate-event";

/**
 * Right-rail trending topics (last 24h, engagement + time decay). Debounced refetch on community writes.
 * @param {{ limit?: number; variant?: "shell" | "portal"; className?: string }} props
 */
export default function TrendingSidebar({ limit = 10, variant = "shell", className = "" }) {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch(`/api/community/trending?limit=${limit}`, {
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
  }, [limit]);

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

  const shell = variant === "shell";
  const cardClass = shell
    ? "rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-sm dark:border-zinc-700 dark:bg-slate-900/80"
    : "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-slate-900/80";

  return (
    <section className={`${cardClass} ${className}`.trim()} aria-labelledby="trending-heading">
      <div className="flex items-center gap-2">
        <TrendingUp className={`h-5 w-5 shrink-0 ${shell ? "text-amber-600 dark:text-amber-400" : "text-amber-600 dark:text-amber-400"}`} aria-hidden />
        <h2 id="trending-heading" className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          Trending
        </h2>
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Last 24 hours · by engagement</p>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : topics.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">No trending topics yet. Post something to seed the feed.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {topics.map((row, i) => (
            <li key={row.topic} className="flex gap-3 text-sm">
              <span className="w-5 shrink-0 pt-0.5 text-right text-xs font-bold text-zinc-400 dark:text-zinc-500">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">{row.topic}</p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {row.total_posts} post{row.total_posts === 1 ? "" : "s"} · score {row.trend_score}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
