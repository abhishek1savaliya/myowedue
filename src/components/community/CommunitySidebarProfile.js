"use client";

import Link from "next/link";
import { Settings2 } from "lucide-react";
import { communityProfilePathByUsername } from "@/lib/community-usernames";
import { COMMUNITY_GLASS_CARD } from "@/lib/community-ui";
import { useUserStore } from "@/stores/useUserStore";

/**
 * @param {{ loggedIn: boolean; authChecked?: boolean }} props
 */
export default function CommunitySidebarProfile({ loggedIn, authChecked = true }) {
  const me = useUserStore((s) => s.user);
  const status = useUserStore((s) => s.status);
  const loaded = authChecked && (status === "ready" || status === "error" || !loggedIn);

  if (!authChecked || (!loggedIn && !loaded)) {
    return (
      <div
        className="h-38 w-full animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-white/5"
        aria-hidden
      />
    );
  }

  if (!loggedIn) {
    return (
      <div className={`${COMMUNITY_GLASS_CARD} w-full p-4`}>
        <p className="text-xs leading-relaxed text-zinc-400">Sign in to see your profile here.</p>
        <Link
          href="/login?next=/community"
          className="mt-3 inline-block text-xs font-semibold text-amber-400 underline underline-offset-2 hover:text-amber-300"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (!loaded || !me) {
    return (
      <div
        className="h-38 w-full animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-white/5"
        aria-hidden
      />
    );
  }

  const name = me?.name || [me?.firstName, me?.lastName].filter(Boolean).join(" ") || "Member";
  const handle = typeof me?.communityUsername === "string" ? me.communityUsername : "";
  const profileHref = handle ? communityProfilePathByUsername(handle) : "/community/settings";
  const initial = String(name).trim().slice(0, 1).toUpperCase() || "?";

  return (
    <div className={`${COMMUNITY_GLASS_CARD} w-full p-4`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Your profile</p>
      <Link
        href={profileHref}
        className="mt-3 flex w-full min-w-0 items-center gap-3 rounded-xl p-1 transition hover:bg-white/5"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500 text-base font-bold text-slate-950">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{name}</p>
          <p className="mt-0.5 truncate text-xs text-zinc-400">
            {handle ? `@${handle}` : "Set @username →"}
          </p>
        </div>
      </Link>
      <Link
        href="/community/settings"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 py-2.5 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-100 dark:border-white/15 dark:bg-white/5 dark:text-zinc-100 dark:hover:border-white/25 dark:hover:bg-white/10"
      >
        <Settings2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        Settings
      </Link>
    </div>
  );
}
