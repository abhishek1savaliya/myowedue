"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Lock, TrendingUp } from "lucide-react";

function formatTopicLabel(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/**
 * Public landing: top 5 trending community topics + CTA to signup.
 */
export default function HomeTrendingSection() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/community/trending?limit=5", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setUnavailable(res.status === 503);
          setTopics([]);
          return;
        }
        setUnavailable(false);
        setTopics((Array.isArray(data.topics) ? data.topics : []).slice(0, 5));
      } catch {
        if (!cancelled) {
          setTopics([]);
          setUnavailable(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="frontpage-reveal frontpage-delay-2 relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:border-zinc-700 dark:bg-slate-900/85 md:p-8"
      aria-labelledby="home-trending-heading"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-amber-500 via-emerald-500 to-amber-400 opacity-90" />

      <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:justify-between lg:gap-10">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
            <h2 id="home-trending-heading" className="text-xl font-bold tracking-tight text-black dark:text-zinc-100 md:text-2xl">
              Trending in the community
            </h2>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            A live snapshot of what people are talking about. Create a free account to read posts, react, and join the conversation.
          </p>

          {loading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
              Loading trending topics…
            </div>
          ) : topics.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
              {unavailable
                ? "Community highlights are not available right now. You can still sign up to explore when the feed is live."
                : "No trending topics in the last day yet. Be among the first to start a thread after you sign up."}
            </p>
          ) : (
            <ol className="mt-6 space-y-3">
              {topics.map((row, i) => (
                <li
                  key={`${row.topic}-${i}`}
                  className="flex gap-3 rounded-xl border border-zinc-100 bg-zinc-50/90 px-3 py-2.5 dark:border-zinc-700/80 dark:bg-slate-800/60"
                >
                  <span className="w-7 shrink-0 pt-0.5 text-right text-xs font-bold tabular-nums text-zinc-400 dark:text-zinc-500">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{formatTopicLabel(row.topic)}</p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {row.total_posts} post{row.total_posts === 1 ? "" : "s"} · heat {row.trend_score}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex shrink-0 flex-col justify-center rounded-2xl border border-amber-200/80 bg-linear-to-br from-amber-50 to-white p-6 dark:border-amber-500/30 dark:from-amber-950/40 dark:to-slate-900/80 lg:max-w-sm lg:self-center">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <Lock className="h-5 w-5 shrink-0" aria-hidden />
            <p className="text-sm font-semibold uppercase tracking-[0.12em]">Full feed locked</p>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            Unlock discussions, comments, and your own posts with a free OWE DUE account.
          </p>
          <Link
            href="/signup"
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-linear-to-r from-amber-500 to-amber-600 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:from-amber-600 hover:to-amber-700"
          >
            Unlock — sign up free
          </Link>
          <Link
            href="/login?next=/community"
            className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-zinc-300 bg-white/80 px-5 py-2.5 text-center text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-slate-900/60 dark:text-zinc-100 dark:hover:bg-slate-800/80"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
