"use client";

import Link from "next/link";
import { useId } from "react";
import { Loader2, Lock, TrendingUp } from "lucide-react";
import { getTrendingDisplayForUser } from "@/lib/community-trending-preview";

/**
 * @param {{
 *   topics: Array<{ topic: string; total_posts: number; trend_score: number }>;
 *   loading: boolean;
 *   limit?: number;
 *   variant?: "shell" | "portal";
 *   className?: string;
 *   linkBasePath?: string | null;
 *   isPremium?: boolean;
 * }} props
 */
export default function TrendingTopicsCard({
  topics,
  loading,
  limit = 10,
  variant = "shell",
  className = "",
  linkBasePath = null,
  isPremium = false,
}) {
  const headingId = useId();
  const shell = variant === "shell";
  const cardClass = shell
    ? "community-glass-card rounded-xl border p-4 shadow-sm"
    : "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90";

  const { rows, rankOffset, totalCount, isPreview, hiddenCount, hiddenAbove, hiddenBelow } =
    getTrendingDisplayForUser(topics, limit, {
      isPremium,
    });

  function topicHref(topic) {
    if (!linkBasePath) return null;
    const base = linkBasePath.split("?")[0] || linkBasePath;
    const q = new URLSearchParams();
    q.set("topic", topic);
    return `${base}?${q.toString()}`;
  }

  function renderProGate({ position, hidden }) {
    const isAbove = position === "above";
    const hint = isAbove
      ? `${hidden} more above · ranks 1–${hidden}`
      : `${hidden} more below · ranks ${rankOffset + rows.length + 1}–${totalCount}`;

    return (
      <li className="list-none">
        <Link
          href="/my-subscription?purchase=1"
          className={`flex items-center gap-2.5 rounded-lg border border-dashed px-3 py-2.5 transition ${
            shell
              ? "border-amber-500/35 bg-amber-500/8 hover:border-amber-500/50 hover:bg-amber-500/12"
              : "border-amber-300/80 bg-amber-50/80 hover:bg-amber-100 dark:border-amber-500/35 dark:bg-amber-950/30 dark:hover:bg-amber-950/45"
          }`}
        >
          <Lock
            className={`h-4 w-4 shrink-0 ${shell ? "text-amber-400" : "text-amber-600 dark:text-amber-400"}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${shell ? "text-amber-300" : "text-amber-700 dark:text-amber-300"}`}>
              Pro
            </p>
            <p className={`text-[11px] ${shell ? "text-zinc-500" : "text-zinc-500 dark:text-zinc-400"}`}>{hint}</p>
          </div>
        </Link>
      </li>
    );
  }

  return (
    <section className={`${cardClass} ${className}`.trim()} aria-labelledby={headingId}>
      <div className="flex items-center gap-2">
        <TrendingUp className={`h-5 w-5 shrink-0 ${shell ? "text-amber-400/90" : "text-zinc-600 dark:text-zinc-400"}`} aria-hidden />
        <h2 id={headingId} className={`text-base font-semibold ${shell ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-900 dark:text-zinc-100"}`}>
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
          {isPreview && hiddenAbove > 0 ? renderProGate({ position: "above", hidden: hiddenAbove }) : null}
          {rows.map((row, i) => {
            const href = topicHref(row.topic);
            const inner = (
              <>
                <span className={`w-5 shrink-0 pt-0.5 text-right text-xs font-bold ${shell ? "text-zinc-500" : "text-zinc-400 dark:text-zinc-500"}`}>
                  {rankOffset + i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold ${shell ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-900 dark:text-zinc-100"}`}>{row.topic}</p>
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
          {isPreview && hiddenBelow > 0 ? renderProGate({ position: "below", hidden: hiddenBelow }) : null}
        </ol>
      )}

      {!loading && isPreview && totalCount > 2 ? (
        <div
          className={`mt-4 flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
            shell
              ? "border-amber-500/30 bg-amber-500/10"
              : "border-amber-200 bg-amber-50 dark:border-amber-500/35 dark:bg-amber-950/40"
          }`}
        >
          <Lock
            className={`mt-0.5 h-4 w-4 shrink-0 ${shell ? "text-amber-400" : "text-amber-600 dark:text-amber-400"}`}
            aria-hidden
          />
          <p className={`text-sm leading-snug ${shell ? "text-zinc-300" : "text-zinc-700 dark:text-zinc-300"}`}>
            <span className="font-semibold text-amber-600 dark:text-amber-300">Pro:</span> see all {totalCount} trending
            topics ({hiddenCount} hidden on Free).{" "}
            <Link
              href="/my-subscription?purchase=1"
              className="font-semibold text-amber-700 underline underline-offset-2 dark:text-amber-300"
            >
              Upgrade to Pro
            </Link>
          </p>
        </div>
      ) : null}
    </section>
  );
}
