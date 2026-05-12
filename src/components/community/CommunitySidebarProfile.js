"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { communityProfilePathByUsername } from "@/lib/community-usernames";

const cardShell =
  "rounded-3xl border border-zinc-800/90 bg-zinc-900 p-5 text-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_4px_28px_rgba(0,0,0,0.35)]";

export default function CommunitySidebarProfile({ loggedIn, authChecked = true }) {
  const [me, setMe] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loggedIn) {
      setMe(null);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data?.user) setMe(data.user);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  if (!authChecked || (!loggedIn && !loaded)) {
    return (
      <div className="h-38 animate-pulse rounded-3xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800" aria-hidden />
    );
  }

  if (!loggedIn) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:border-zinc-700 dark:bg-zinc-900/90">
        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">Sign in to see your profile here.</p>
        <Link
          href="/login?next=/community"
          className="mt-3 inline-block text-xs font-semibold text-amber-700 underline underline-offset-2 dark:text-amber-400"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="h-38 animate-pulse rounded-3xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800" aria-hidden />
    );
  }

  const name = me?.name || [me?.firstName, me?.lastName].filter(Boolean).join(" ") || "Member";
  const handle = typeof me?.communityUsername === "string" ? me.communityUsername : "";
  const profileHref = handle ? communityProfilePathByUsername(handle) : "/community/settings";
  const initial = String(name).trim().slice(0, 1).toUpperCase() || "?";

  return (
    <div className={cardShell}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Your profile</p>
      <Link
        href={profileHref}
        className="mt-4 -mx-1 flex items-center gap-3.5 rounded-2xl p-1 transition hover:bg-white/6"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[17px] font-bold leading-none tracking-tight text-zinc-900">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-snug text-white">{name}</p>
          <p className="mt-0.5 truncate text-[13px] font-normal text-zinc-400">
            {handle ? `@${handle}` : "Set @username →"}
          </p>
        </div>
      </Link>
      <Link
        href="/community/settings"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-white py-3 text-[13px] font-semibold text-white transition hover:bg-white/10 active:bg-white/14"
      >
        <Settings2 className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
        Settings
      </Link>
    </div>
  );
}
