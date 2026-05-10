"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { PenSquare, Users } from "lucide-react";
import PublicModeToggle from "@/components/PublicModeToggle";
import CommunityFeedClient from "@/components/community/CommunityFeedClient";

const navItem =
  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold text-zinc-800 transition hover:bg-stone-100 dark:text-zinc-100 dark:hover:bg-zinc-800/80";

export default function CommunityPublicShell() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data?.user) setLoggedIn(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const postHref = loggedIn ? "/posts" : "/login?next=/posts";
  const appHref = loggedIn ? "/dashboard" : "/login?next=/dashboard";

  return (
    <div className="relative min-h-screen bg-stone-100 text-zinc-900 dark:bg-slate-950 dark:text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,0.12),transparent_35%),radial-gradient(circle_at_90%_100%,rgba(16,185,129,0.12),transparent_36%)]" />

      {/* Mobile top */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-stone-200/90 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-slate-950/90 md:hidden">
        <Link href="/" className="inline-flex items-center gap-2 font-bold tracking-wide text-zinc-900 dark:text-white">
          <Image src="/owedue-logo.svg" alt="OWE DUE" width={32} height={32} className="h-8 w-8 rounded-lg" />
        </Link>
        <div className="flex items-center gap-2">
          <PublicModeToggle />
          {loggedIn ? (
            <Link
              href="/dashboard"
              className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-stone-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              App
            </Link>
          ) : (
            <>
              <Link
                href="/login?next=/community"
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-stone-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-600"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="relative mx-auto flex min-h-[calc(100dvh-56px)] max-w-[1200px] md:min-h-screen">
        {/* Left */}
        <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-stone-200 bg-white/90 py-4 pl-4 pr-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-slate-950/90 md:flex">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 rounded-lg px-1 font-bold text-zinc-900 dark:text-white" aria-label="OWE DUE home">
            <Image src="/owedue-logo.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <span className="text-sm tracking-wide">OWE DUE</span>
          </Link>

          <nav className="flex flex-1 flex-col gap-0.5" aria-label="Community">
            <Link href="/community" className={`${navItem} bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200`} aria-current="page">
              <Users className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} />
              Community
            </Link>
          </nav>

          <div className="mt-auto space-y-3 border-t border-stone-200 pt-4 dark:border-zinc-800">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Display</p>
            <PublicModeToggle />
            <Link
              href={postHref}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600"
            >
              <PenSquare className="h-4 w-4" strokeWidth={2} />
              Post
            </Link>
          </div>
        </aside>

        {/* Feed */}
        <main className="relative min-h-0 min-w-0 flex-1 border-stone-200 dark:border-zinc-800 md:border-x">
          <CommunityFeedClient variant="public" skin="x" shareBasePath="/community" loginNextPath="/community" />
        </main>

        {/* Right — only real app links */}
        <aside className="sticky top-0 hidden w-[280px] shrink-0 flex-col gap-4 py-6 pl-4 pr-6 lg:flex">
          <div className="rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-sm dark:border-zinc-700 dark:bg-slate-900/80">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Use the full app</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Track dues, files, and reminders alongside this community feed.
            </p>
            <Link
              href={appHref}
              className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-amber-500 py-2.5 text-sm font-bold text-white hover:bg-amber-600"
            >
              {loggedIn ? "Open dashboard" : "Sign in"}
            </Link>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            © {new Date().getFullYear()} OWE DUE ·{" "}
            <Link href="/" className="font-medium text-amber-700 hover:underline dark:text-amber-400">
              Home
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
