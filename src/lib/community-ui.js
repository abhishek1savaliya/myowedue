/** Shared surfaces for the public community shell — follow `data-theme` on `.community-shell`. */

export const COMMUNITY_GLASS_CARD =
  "community-glass-card community-feed-post rounded-xl border shadow-sm";

export const COMMUNITY_GLASS_CARD_INNER =
  "rounded-lg border border-zinc-200/80 bg-zinc-50/80 dark:border-white/[0.08] dark:bg-white/[0.03]";

export const COMMUNITY_FEED_HEADER_TITLE =
  "text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50";

export const COMMUNITY_FEED_HEADER_SUB = "text-sm text-zinc-600 dark:text-zinc-400";

export const COMMUNITY_BTN_SECONDARY =
  "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-zinc-100 dark:hover:border-white/25 dark:hover:bg-white/10";

/** Primary CTA on dark community chrome — avoids theme-variant clashes (e.g. white-on-white). */
export const COMMUNITY_BTN_PRIMARY =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-slate-950 shadow-[0_4px_20px_rgba(245,158,11,0.28)] transition hover:bg-amber-400 active:bg-amber-300";

/** Centered feed column — full width on mobile with safe horizontal padding. */
export const COMMUNITY_FEED_SHELL =
  "mx-auto w-full min-w-0 max-w-xl space-y-6 px-4 py-4 sm:px-5 md:py-6";
