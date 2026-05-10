"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PenSquare, Settings2, Users } from "lucide-react";
import PublicModeToggle from "@/components/PublicModeToggle";
import CommunityNotificationsSidebar from "@/components/community/CommunityNotificationsSidebar";
import TrendingSidebar from "@/components/community/TrendingSidebar";

const navItem =
  "group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-[15px] font-medium text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/80";

const navActive =
  "border-zinc-200 bg-white text-zinc-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50";

export default function CommunityPublicShell({ children }) {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);

  const feedActive = pathname === "/community" || pathname.startsWith("/community/post/");
  const settingsActive = pathname.startsWith("/community/settings");

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
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,0.08),transparent_36%),radial-gradient(circle_at_90%_100%,rgba(16,185,129,0.08),transparent_38%)]" />

      {/* Mobile top */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-200/90 bg-white/95 px-4 py-3 backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-950/95 md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="inline-flex shrink-0 items-center gap-2 font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <Image src="/owedue-logo.svg" alt="OWE DUE" width={32} height={32} className="h-8 w-8 rounded-lg" />
          </Link>
          <Link
            href="/community/settings"
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 ${settingsActive ? "border-zinc-400 bg-zinc-100 text-zinc-900 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-50" : ""}`}
            aria-label="Community settings"
            aria-current={settingsActive ? "page" : undefined}
          >
            <Settings2 className="h-5 w-5" strokeWidth={2} />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <PublicModeToggle />
          {loggedIn ? (
            <Link
              href="/dashboard"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              App
            </Link>
          ) : (
            <>
              <Link
                href="/login?next=/community"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="relative mx-auto flex min-h-[calc(100dvh-56px)] max-w-[1200px] md:min-h-screen">
        {/* Left */}
        <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-zinc-200 bg-white/95 py-4 pl-4 pr-3 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-950/95 md:flex">
          <Link href="/" className="mb-6 inline-flex shrink-0 items-center gap-2 rounded-lg px-1 font-semibold tracking-tight text-zinc-900 dark:text-zinc-50" aria-label="OWE DUE home">
            <Image src="/owedue-logo.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <span className="text-sm tracking-wide">OWE DUE</span>
          </Link>

          <nav className="mt-1 flex shrink-0 flex-col gap-0.5" aria-label="Community">
            <Link
              href="/community"
              className={`${navItem} ${feedActive ? navActive : ""}`}
              aria-current={feedActive ? "page" : undefined}
            >
              <Users className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={2} />
              Community
            </Link>
            <Link
              href="/community/settings"
              className={`${navItem} ${settingsActive ? navActive : ""}`}
              aria-current={settingsActive ? "page" : undefined}
            >
              <Settings2 className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={2} />
              Settings
            </Link>
          </nav>

          <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <CommunityNotificationsSidebar loggedIn={loggedIn} />
          </div>

          <div className="mt-4 shrink-0 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Display</p>
            <PublicModeToggle />
            <Link
              href={postHref}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
            >
              <PenSquare className="h-4 w-4" strokeWidth={2} />
              Post
            </Link>
          </div>
        </aside>

        {/* Trending in the right rail (sticky on lg+). Settings: left nav (md+) or mobile header. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
          <main className="relative order-2 min-h-0 min-w-0 flex-1 border-zinc-200 dark:border-zinc-700 md:border-x lg:order-1">
            {children}
          </main>

          <aside className="order-1 flex w-full shrink-0 flex-col gap-4 border-b border-zinc-200 bg-zinc-50/90 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900/40 lg:sticky lg:top-0 lg:order-2 lg:h-dvh lg:max-h-screen lg:w-[280px] lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-l lg:border-zinc-200 lg:bg-transparent lg:py-6 lg:pl-4 lg:pr-6 dark:lg:border-zinc-700">
            <div className="space-y-3 lg:shrink-0">
              <TrendingSidebar limit={10} variant="shell" className="p-3" />
            </div>
            <div className="hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-600 dark:bg-zinc-900/90 lg:block">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Use the full app</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Track dues, files, and reminders alongside this community feed.
              </p>
              <Link
                href={appHref}
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
              >
                {loggedIn ? "Open dashboard" : "Sign in"}
              </Link>
            </div>

            <p className="hidden text-xs text-zinc-500 dark:text-zinc-400 lg:block">
              © {new Date().getFullYear()} OWE DUE ·{" "}
              <Link href="/" className="font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-zinc-100">
                Home
              </Link>
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
