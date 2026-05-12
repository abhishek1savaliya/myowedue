"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Home, Menu, PenSquare, Search, Settings2, X } from "lucide-react";
import PublicModeToggle from "@/components/PublicModeToggle";
import CommunityNotificationsSidebar from "@/components/community/CommunityNotificationsSidebar";
import CommunitySidebarProfile from "@/components/community/CommunitySidebarProfile";
import CommunitySidebarSearch from "@/components/community/CommunitySidebarSearch";
import TrendingSidebar from "@/components/community/TrendingSidebar";

const navItem =
  "group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-[15px] font-medium text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/80";

const navActive =
  "border-zinc-200 bg-white text-zinc-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50";

function SidebarContent({ loggedIn, authChecked, homeActive, searchActive, notificationsActive, settingsActive, postHref, onNavigate }) {
  return (
    <>
      <nav className="flex shrink-0 flex-col gap-0.5" aria-label="Community">
        <Link
          href="/community"
          onClick={onNavigate}
          className={`${navItem} ${homeActive ? navActive : ""}`}
          aria-current={homeActive ? "page" : undefined}
        >
          <Home className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={2} />
          Home
        </Link>
        <Link
          href="/community/search"
          onClick={onNavigate}
          className={`${navItem} ${searchActive ? navActive : ""}`}
          aria-current={searchActive ? "page" : undefined}
        >
          <Search className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={2} />
          Search
        </Link>
        <Link
          href="/community/notifications"
          onClick={onNavigate}
          className={`${navItem} ${notificationsActive ? navActive : ""}`}
          aria-current={notificationsActive ? "page" : undefined}
        >
          <Bell className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={2} />
          Notifications
        </Link>
        <Link
          href="/community/settings"
          onClick={onNavigate}
          className={`${navItem} ${settingsActive ? navActive : ""}`}
          aria-current={settingsActive ? "page" : undefined}
        >
          <Settings2 className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={2} />
          Settings
        </Link>
      </nav>

      <CommunitySidebarSearch />

      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <CommunityNotificationsSidebar loggedIn={loggedIn} authChecked={authChecked} />
      </div>

      <div className="mt-4 shrink-0 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Display</p>
        <PublicModeToggle />
        <Link
          href={postHref}
          onClick={onNavigate}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
        >
          <PenSquare className="h-4 w-4" strokeWidth={2} />
          Post
        </Link>
      </div>

      <div className="mt-4 shrink-0 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <CommunitySidebarProfile loggedIn={loggedIn} authChecked={authChecked} />
      </div>
    </>
  );
}

export default function CommunityPublicShell({ children }) {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const homeActive = pathname === "/community" || pathname.startsWith("/community/post/");
  const searchActive = pathname.startsWith("/community/search");
  const notificationsActive = pathname.startsWith("/community/notifications");
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
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const postHref = loggedIn ? "/posts" : "/login?next=/posts";
  const appHref = loggedIn ? "/dashboard" : "/login?next=/dashboard";

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,0.08),transparent_36%),radial-gradient(circle_at_90%_100%,rgba(16,185,129,0.08),transparent_38%)]" />

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-200/90 bg-white/95 px-3 py-2.5 backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-950/95 md:hidden">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>
          <Link href="/community" className="inline-flex shrink-0 items-center gap-1.5 font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <Image src="/owedue-logo.svg" alt="OWE DUE" width={28} height={28} className="h-7 w-7 rounded-md" />
            <span className="text-sm">Community</span>
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          <PublicModeToggle />
          {!authChecked ? (
            <div className="h-7 w-14 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          ) : loggedIn ? (
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
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Mobile drawer overlay + panel */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
            onClick={closeDrawer}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col overflow-y-auto bg-white py-4 pl-4 pr-3 shadow-2xl dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between">
              <Link
                href="/"
                onClick={closeDrawer}
                className="inline-flex items-center gap-2 rounded-lg px-1 font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
                aria-label="OWE DUE home"
              >
                <Image src="/owedue-logo.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
                <span className="text-sm tracking-wide">OWE DUE</span>
              </Link>
              <button
                type="button"
                onClick={closeDrawer}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            <SidebarContent
              loggedIn={loggedIn}
              authChecked={authChecked}
              homeActive={homeActive}
              searchActive={searchActive}
              notificationsActive={notificationsActive}
              settingsActive={settingsActive}
              postHref={postHref}
              onNavigate={closeDrawer}
            />
          </aside>
        </div>
      ) : null}

      <div className="relative mx-auto flex min-h-[calc(100dvh-53px)] max-w-[1200px] md:min-h-screen">
        {/* Desktop left sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-zinc-200/90 bg-white/80 py-4 pl-4 pr-3 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-950/90 md:flex">
          <Link
            href="/"
            className="mb-5 inline-flex shrink-0 items-center gap-2 rounded-lg px-1 font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            aria-label="OWE DUE home"
          >
            <Image src="/owedue-logo.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <span className="text-sm tracking-wide">OWE DUE</span>
          </Link>
          <SidebarContent
            loggedIn={loggedIn}
            authChecked={authChecked}
            homeActive={homeActive}
            searchActive={searchActive}
            notificationsActive={notificationsActive}
            settingsActive={settingsActive}
            postHref={postHref}
          />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
          <main className="relative order-2 min-h-0 min-w-0 flex-1 border-zinc-200 bg-background pb-20 dark:border-zinc-700 md:border-x md:pb-0 lg:order-1">
            {children}
          </main>

          <aside className="order-1 flex w-full shrink-0 flex-col gap-4 border-b border-zinc-200 bg-zinc-50/90 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900/40 lg:sticky lg:top-0 lg:order-2 lg:h-dvh lg:max-h-screen lg:w-[280px] lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-l lg:border-zinc-200 lg:bg-transparent lg:py-6 lg:pl-4 lg:pr-6 dark:lg:border-zinc-700">
            <div className="space-y-3 lg:shrink-0">
              <TrendingSidebar limit={10} variant="shell" className="p-3" />
            </div>
            <div className="hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:border-zinc-600 dark:bg-zinc-900/90 lg:block">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Use the full app</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Track dues, files, and reminders alongside this community feed.
              </p>
              {authChecked ? (
                <Link
                  href={appHref}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                >
                  {loggedIn ? "Open dashboard" : "Sign in"}
                </Link>
              ) : (
                <div className="mt-4 h-10 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
              )}
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

      {/* Mobile bottom bar — quick access to key actions */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-zinc-200/90 bg-white/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-950/95 md:hidden" aria-label="Quick actions">
        <Link
          href="/community"
          className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${homeActive ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}`}
        >
          <Home className="h-5 w-5" strokeWidth={homeActive ? 2.5 : 2} />
          Home
        </Link>
        <Link
          href="/community/search"
          className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${searchActive ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}`}
        >
          <Search className="h-5 w-5" strokeWidth={searchActive ? 2.5 : 2} />
          Search
        </Link>
        <Link
          href="/community/notifications"
          className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${notificationsActive ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}`}
        >
          <Bell className="h-5 w-5" strokeWidth={notificationsActive ? 2.5 : 2} />
          Alerts
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-zinc-500 transition dark:text-zinc-400"
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
          More
        </button>
      </nav>
    </div>
  );
}
