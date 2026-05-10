"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { communityProfilePathByUsername } from "@/lib/community-usernames";

export default function CommunitySidebarProfile({ loggedIn }) {
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

  if (!loggedIn) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:border-zinc-600 dark:bg-zinc-900/80">
        <p className="text-xs text-zinc-600 dark:text-zinc-400">Sign in to see your profile here.</p>
        <Link
          href="/login?next=/community"
          className="mt-2 inline-block text-xs font-semibold text-amber-700 underline underline-offset-2 dark:text-amber-400"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="h-28 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800" aria-hidden />
    );
  }

  const name = me?.name || [me?.firstName, me?.lastName].filter(Boolean).join(" ") || "Member";
  const handle = typeof me?.communityUsername === "string" ? me.communityUsername : "";
  const profileHref = handle ? communityProfilePathByUsername(handle) : "/community/settings";
  const initial = String(name).trim().slice(0, 1).toUpperCase() || "?";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Your profile</p>
      <Link
        href={profileHref}
        className="mt-3 flex items-center gap-3 rounded-xl p-1 transition hover:bg-white/5"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-base font-semibold text-zinc-900">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{name}</p>
          <p className="truncate text-xs text-zinc-400">{handle ? `@${handle}` : "Set @username →"}</p>
        </div>
      </Link>
      <Link
        href="/community/settings"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white bg-transparent py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
      >
        <Settings2 className="h-4 w-4" aria-hidden />
        Settings
      </Link>
    </div>
  );
}
