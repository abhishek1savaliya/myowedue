/** Shared surfaces for the public community shell (dark glass, matches sidebar). */

export const COMMUNITY_GLASS_CARD =
  "community-feed-post rounded-xl border border-white/10 bg-slate-950/80 shadow-[0_8px_32px_rgba(0,0,0,0.22)]";

export const COMMUNITY_GLASS_CARD_INNER =
  "rounded-lg border border-white/[0.08] bg-white/[0.03]";

export const COMMUNITY_FEED_HEADER_TITLE = "text-2xl font-semibold tracking-tight text-zinc-50";

export const COMMUNITY_FEED_HEADER_SUB =
  "text-sm text-zinc-400";

export const COMMUNITY_BTN_SECONDARY =
  "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-100 shadow-sm transition hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60";

/** Primary CTA on dark community chrome — avoids theme-variant clashes (e.g. white-on-white). */
export const COMMUNITY_BTN_PRIMARY =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-slate-950 shadow-[0_4px_20px_rgba(245,158,11,0.28)] transition hover:bg-amber-400 active:bg-amber-300";
