"use client";

import Link from "next/link";
import { useId } from "react";
import { Loader2, TrendingUp } from "lucide-react";

/**
 * @param {{
 *   topics: Array<{ topic: string; total_posts: number; trend_score: number }>;
 *   loading: boolean;
 *   limit?: number;
 *   variant?: "shell" | "portal";
 *   className?: string;
 *   linkBasePath?: string | null;
 * }} props
 */
export default function TrendingTopicsCard({
  topics,
  loading,
  limit = 10,
  variant = "shell",
  className = "",
  linkBasePath = null,
}) {
  const headingId = useId();
  const shell = variant === "shell";
  const cardClass = shell
    ? "rounded-xl border border-white/10 bg-slate-950/55 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)] backdrop-blur-md"
    : "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90";

  const rows = (Array.isArray(topics) ? topics : []).slice(0, limit);

  function topicHref(topic) {
    if (!linkBasePath) return null;
    const base = linkBasePath.split("?")[0] || linkBasePath;
    const q = new URLSearchParams();
    q.set("topic", topic);
    return `${base}?${q.toString()}`;
  }

  return (
    <section className={`${cardClass} ${className}`.trim()} aria-labelledby={headingId}>
      <div className="flex items-center gap-2">
        <TrendingUp className={`h-5 w-5 shrink-0 ${shell ? "text-amber-400/90" : "text-zinc-600 dark:text-zinc-400"}`} aria-hidden />
        <h2 id={headingId} className={`text-base font-semibold ${shell ? "text-zinc-50" : "text-zinc-900 dark:text-zinc-100"}`}>
          Trending
        </h2>
      </div>
      <p className={`mt-1 text-xs ${shell ? "text-zinc-500" : "text-zinc-500 dark:text-zinc-400"}`}>Last 24 hours · by engagement</p>

      {loading ? (
        <div className={`mt-4 flex items-center gap-2 text-sm ${shell ? "text-zinc-500" : "text-zinc-500 dark:text-zinc-400"}`}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className={`mt-4 text-sm ${shell ? "text-zinc-400" : "text-zinc-600 dark:text-zinc-400"}`}>No trending topics yet. Post something to seed the feed.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {rows.map((row, i) => {
            const href = topicHref(row.topic);
            const inner = (
              <>
                <span className={`w-5 shrink-0 pt-0.5 text-right text-xs font-bold ${shell ? "text-zinc-500" : "text-zinc-400 dark:text-zinc-500"}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold ${shell ? "text-zinc-100" : "text-zinc-900 dark:text-zinc-100"}`}>{row.topic}</p>
                  <p className={`mt-0.5 text-xs ${shell ? "text-zinc-500" : "text-zinc-500 dark:text-zinc-400"}`}>
                    {row.total_posts} post{row.total_posts === 1 ? "" : "s"} · score {row.trend_score}
                  </p>
                </div>
              </>
            );
            return (
              <li key={row.topic} className="flex gap-3 text-sm">
                {href ? (
                  <Link
                    href={href}
                    className={
                      shell
                        ? "flex min-w-0 flex-1 gap-3 rounded-lg outline-none transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-amber-500/40"
                        : "flex min-w-0 flex-1 gap-3 rounded-lg outline-none ring-zinc-400 transition hover:bg-zinc-100 focus-visible:ring-2 dark:hover:bg-zinc-800/80 dark:ring-zinc-500"
                    }
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 gap-3">{inner}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
