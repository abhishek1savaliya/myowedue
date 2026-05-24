"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Home, Loader2, Menu, PenSquare, Search, Settings2, TrendingUp, X } from "lucide-react";
import PublicModeToggle from "@/components/PublicModeToggle";
import CommunitySidebarProfile from "@/components/community/CommunitySidebarProfile";
import SuggestedCreatorsRail from "@/components/community/SuggestedCreatorsRail";
import TrendingTopicsFromApi from "@/components/community/TrendingTopicsFromApi";
import CommunityStoreBootstrap from "@/components/community/CommunityStoreBootstrap";
import { COMMUNITY_BTN_PRIMARY } from "@/lib/community-ui";
import { useCommunityAuth } from "@/hooks/useCommunityAuth";

const navItem =
  "community-nav-item group flex w-full min-w-0 items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-[15px] font-medium text-zinc-600 transition hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-zinc-100";

const navActive =
  "is-active border-amber-500/40 bg-amber-500/15 text-amber-900 shadow-[0_0_20px_rgba(245,158,11,0.08)] dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 dark:shadow-[0_0_20px_rgba(245,158,11,0.1)]";

function SidebarContent({
  loggedIn,
  authChecked,
  homeActive,
  searchActive,
  trendingActive,
  notificationsActive,
  settingsActive,
  postHref,
  onNavigate,
}) {
  return (
    <div className="flex w-full min-w-0 flex-1 flex-col">
      <nav className="flex w-full shrink-0 flex-col gap-0.5" aria-label="Community">
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
          href="/community/trending"
          onClick={onNavigate}
          className={`${navItem} ${trendingActive ? navActive : ""}`}
          aria-current={trendingActive ? "page" : undefined}
        >
          <TrendingUp className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={2} />
          Trending
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

      <div className="mt-4 w-full shrink-0 space-y-3 border-t border-zinc-200/80 pt-4 dark:border-white/8">
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Display</p>
          <PublicModeToggle />
        </div>
        <Link href={postHref} onClick={onNavigate} className={COMMUNITY_BTN_PRIMARY}>
          <PenSquare className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          Post
        </Link>
      </div>

      <div className="mt-4 w-full shrink-0 border-t border-zinc-200/80 pt-4 dark:border-white/8">
        <CommunitySidebarProfile loggedIn={loggedIn} authChecked={authChecked} />
      </div>
    </div>
  );
}

export default function CommunityPublicShell({ children, initialUser = null }) {
  const pathname = usePathname();
  const { authChecked, loggedIn } = useCommunityAuth(initialUser);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const homeActive = pathname === "/community" || pathname.startsWith("/community/post/");
  const searchActive = pathname.startsWith("/community/search");
  const trendingActive = pathname.startsWith("/community/trending");
  const notificationsActive = pathname.startsWith("/community/notifications");
  const settingsActive = pathname.startsWith("/community/settings");
  const hideRightRailTrending = trendingActive;

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

  const childrenWithInitialUser = useMemo(
    () =>
      !initialUser
        ? children
        : Children.map(children, (child) =>
            isValidElement(child) ? cloneElement(child, { initialUser }) : child
          ),
    [children, initialUser]
  );

  const shellBackdrop = (
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,0.08),transparent_36%),radial-gradient(circle_at_90%_100%,rgba(16,185,129,0.08),transparent_38%)]" />
  );

  if (!authChecked) {
    return (
      <div className="community-shell ui-v2-page relative flex min-h-screen w-full max-w-full flex-col overflow-x-clip bg-background text-foreground">
        <CommunityStoreBootstrap />
        {shellBackdrop}
        <div
          className="relative z-10 flex min-h-screen flex-1 flex-col items-center justify-center gap-2 px-4 text-zinc-600 dark:text-zinc-400"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
          <span className="text-sm font-medium">Checking session…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="community-shell ui-v2-page relative min-h-screen w-full max-w-full overflow-x-clip bg-background text-foreground">
      <CommunityStoreBootstrap />
      {shellBackdrop}

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-200/80 bg-background/95 px-3 py-2.5 backdrop-blur-md md:hidden dark:border-white/[0.08] dark:bg-slate-950/95">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link href="/community" className="inline-flex shrink-0 items-center gap-1.5 font-semibold tracking-tight text-foreground">
            <Image src="/owedue-logo.svg" alt="OWE DUE" width={28} height={28} className="h-7 w-7 rounded-md" />
            <span className="text-sm">Community</span>
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
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
            className="absolute inset-0 bg-zinc-950/60"
            onClick={closeDrawer}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(280px,85vw)] max-w-[85vw] flex-col overflow-x-clip overflow-y-auto border-r border-zinc-200 bg-background px-4 py-4 shadow-2xl dark:border-white/8 dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between">
              <Link
                href="/"
                onClick={closeDrawer}
                className="inline-flex items-center gap-2 rounded-lg px-1 font-semibold tracking-tight text-foreground"
                aria-label="OWE DUE home"
              >
                <Image src="/owedue-logo.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
                <span className="text-sm tracking-wide">OWE DUE</span>
              </Link>
              <button
                type="button"
                onClick={closeDrawer}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"
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
              trendingActive={trendingActive}
              notificationsActive={notificationsActive}
              settingsActive={settingsActive}
              postHref={postHref}
              onNavigate={closeDrawer}
            />
          </aside>
        </div>
      ) : null}

      <div className="relative mx-auto flex w-full min-w-0 min-h-[calc(100dvh-53px)] max-w-full md:min-h-screen lg:max-w-[1200px]">
        {/* Desktop left sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col overflow-x-clip border-r border-zinc-200/80 bg-background px-4 py-4 md:flex dark:border-white/8 dark:bg-slate-950/95">
          <Link
            href="/"
            className="mb-5 inline-flex shrink-0 items-center gap-2 rounded-lg px-1 font-semibold tracking-tight text-foreground"
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
            trendingActive={trendingActive}
            notificationsActive={notificationsActive}
            settingsActive={settingsActive}
            postHref={postHref}
          />
        </aside>

        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col lg:flex-row">
          <main className="relative order-2 min-h-0 min-w-0 w-full flex-1 overflow-x-clip border-zinc-200/60 bg-transparent pb-20 md:border-x md:pb-0 lg:order-1 dark:border-white/[0.06]">
            {childrenWithInitialUser}
          </main>

          <aside
            data-community-rail
            className="order-1 hidden w-full shrink-0 flex-col gap-4 border-b border-zinc-200/60 bg-transparent px-4 py-4 lg:sticky lg:top-0 lg:order-2 lg:flex lg:h-dvh lg:max-h-screen lg:w-[280px] lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-l lg:border-zinc-200/60 lg:py-6 lg:pl-4 lg:pr-6 dark:border-white/[0.06]"
          >
            <div className="space-y-3 lg:shrink-0">
              {hideRightRailTrending ? null : (
                <TrendingTopicsFromApi
                  limit={5}
                  variant="shell"
                  className="p-3"
                  linkBasePath="/community"
                />
              )}
              <SuggestedCreatorsRail loggedIn={loggedIn} authChecked={authChecked} className="p-3" />
            </div>
            <div className="community-glass-card hidden rounded-xl border p-4 lg:block">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Use the full app</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Track dues, files, and reminders alongside this community feed.
              </p>
              <Link
                href={appHref}
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400"
              >
                {loggedIn ? "Open dashboard" : "Sign in"}
              </Link>
            </div>

            <p className="hidden text-xs text-zinc-500 dark:text-zinc-500 lg:block">
              © {new Date().getFullYear()} OWE DUE ·{" "}
              <Link href="/" className="font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:underline">
                Home
              </Link>
            </p>
          </aside>
        </div>
      </div>

      {/* Mobile bottom bar — quick access to key actions */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-zinc-200/80 bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md md:hidden dark:border-white/[0.08] dark:bg-slate-950/95" aria-label="Quick actions">
        <Link
          href="/community"
          className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition sm:text-[11px] ${homeActive ? "text-amber-600 dark:text-amber-300" : "text-zinc-500"}`}
        >
          <Home className="h-5 w-5" strokeWidth={homeActive ? 2.5 : 2} />
          Home
        </Link>
        <Link
          href="/community/search"
          className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition sm:text-[11px] ${searchActive ? "text-amber-600 dark:text-amber-300" : "text-zinc-500"}`}
        >
          <Search className="h-5 w-5" strokeWidth={searchActive ? 2.5 : 2} />
          Search
        </Link>
        <Link
          href="/community/trending"
          className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition sm:text-[11px] ${trendingActive ? "text-amber-600 dark:text-amber-300" : "text-zinc-500"}`}
        >
          <TrendingUp className="h-5 w-5" strokeWidth={trendingActive ? 2.5 : 2} />
          Trending
        </Link>
        <Link
          href="/community/notifications"
          className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition sm:text-[11px] ${notificationsActive ? "text-amber-600 dark:text-amber-300" : "text-zinc-500"}`}
        >
          <Bell className="h-5 w-5" strokeWidth={notificationsActive ? 2.5 : 2} />
          Alerts
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium text-zinc-500 transition sm:text-[11px]"
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
          More
        </button>
      </nav>
    </div>
  );
}
