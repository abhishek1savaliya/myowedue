"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { useCommunityTrendingStore } from "@/stores/useCommunityTrendingStore";

function formatTopicLabel(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/**
 * Public landing: top trending community topics and sign-up CTA.
 */
export default function HomeTrendingSection({ variant = "default" }) {
  const isLanding = variant === "landing";
  const topics = useCommunityTrendingStore((s) => s.topics);
  const loading = useCommunityTrendingStore((s) => s.loading);
  const bootstrap = useCommunityTrendingStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const displayTopics = topics.slice(0, 5);
  const unavailable = !loading && displayTopics.length === 0;

  return (
    <section
      className={
        isLanding
          ? "relative overflow-hidden rounded-xl border-0 bg-transparent p-0 shadow-none"
          : "frontpage-reveal frontpage-delay-2 relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:p-8"
      }
      aria-labelledby="home-trending-heading"
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:justify-between lg:gap-12">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <TrendingUp className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden />
            <h2
              id="home-trending-heading"
              className={
                isLanding
                  ? "text-lg font-semibold tracking-tight text-white md:text-xl"
                  : "text-lg font-semibold tracking-tight text-foreground md:text-xl"
              }
            >
              Community activity
            </h2>
          </div>
          <p
            className={
              isLanding
                ? "mt-2 max-w-xl text-sm leading-relaxed text-zinc-400"
                : "mt-2 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
            }
          >
            Popular discussion themes from the last 24 hours. Sign in to read full threads and participate.
          </p>

          {loading && !displayTopics.length ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              Loading topics…
            </div>
          ) : displayTopics.length === 0 ? (
            <p className="mt-6 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {unavailable
                ? "Community data is temporarily unavailable. You can still create an account to access the forum when it is online."
                : "No trending topics in the selected window yet. Start a conversation after you join."}
            </p>
          ) : (
            <ol className="mt-6 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
              {displayTopics.map((row, i) => (
                <li key={`${row.topic}-${i}`} className="flex gap-3 px-3 py-3 first:pt-3.5 last:pb-3.5 sm:px-4">
                  <span className="w-6 shrink-0 pt-0.5 text-right text-xs font-medium tabular-nums text-zinc-400 dark:text-zinc-500">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{formatTopicLabel(row.topic)}</p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {row.total_posts} post{row.total_posts === 1 ? "" : "s"} · score {row.trend_score}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex shrink-0 flex-col justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-800/50 lg:max-w-xs lg:self-stretch">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Member access</p>
          <p className="mt-2 text-sm font-medium leading-snug text-foreground">View the full community feed</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Free accounts include reading, reactions, comments, and new posts.
          </p>
          <Link
            href="/signup"
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
          >
            Create free account
          </Link>
          <Link
            href="/login?next=/community"
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
