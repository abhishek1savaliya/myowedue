"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  FileText,
  Settings,
  Bell,
  Trash2,
  FilePenLine,
  CalendarDays,
  Gem,
  LifeBuoy,
  CreditCard,
  FolderOpen,
  PenLine,
  LogOut,
} from "lucide-react";
import { useUserStore } from "@/stores/useUserStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { useApiCacheStore } from "@/stores/useApiCacheStore";
import { cn } from "@/lib/utils";

const baseLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/posts", label: "Post", icon: PenLine },
  { href: "/people", label: "People", icon: Users },
  { href: "/cards", label: "Cards", icon: CreditCard },
  { href: "/files", label: "Files", icon: FolderOpen },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/bin", label: "Bin", icon: Trash2 },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/my-subscription", label: "My Subscription", icon: Gem },
  { href: "/settings", label: "Settings", icon: Settings },
];

const navLink =
  "group flex min-w-33 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition md:min-w-0 md:justify-start md:gap-3 md:py-3 md:text-sm";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const status = useUserStore((s) => s.status);
  const notificationCount = useNotificationStore((s) => s.count);

  const authChecked = status === "ready" || status === "error";
  const isPremium = Boolean(user?.isPremium);
  const role = String(user?.cmsRole || "");
  const canAccessContentEditor =
    role === "super_admin" || (role === "manager" && Boolean(user?.contentEditPermission));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    useUserStore.getState().clearUser();
    useNotificationStore.getState().disconnect();
    useApiCacheStore.getState().invalidate();
    router.push("/login");
    router.refresh();
  }

  const links = canAccessContentEditor
    ? [...baseLinks, { href: "/content-editor", label: "Content Editor", icon: FilePenLine }]
    : [...baseLinks];

  if (isPremium) {
    links.splice(links.length - 1, 0, { href: "/support", label: "Support", icon: LifeBuoy });
  }

  return (
    <aside className="sticky top-0 z-30 w-full border-b border-zinc-200/80 bg-white/95 px-4 py-3 dark:border-white/10 dark:bg-slate-950/95 md:h-screen md:w-72 md:border-b-0 md:border-r md:px-5 md:py-6">
      <div className="mb-4 flex items-start justify-between gap-3 md:mb-8">
        <div className="inline-flex min-w-0 items-start gap-2.5 p-1">
          <Link href="/dashboard" aria-label="Go to dashboard" className="rounded-xl">
            <Image
              src="/owedue-logo.svg"
              alt="OWE DUE logo"
              width={40}
              height={40}
              priority
              className="h-9 w-9 rounded-lg sm:h-10 sm:w-10"
            />
          </Link>
          <div className="min-w-0">
            <Link
              href="/dashboard"
              className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg"
            >
              OWE DUE
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {!authChecked ? (
                <span className="inline-flex h-5 w-12 animate-pulse rounded-md bg-white/10" />
              ) : isPremium ? (
                <Link
                  href="/my-subscription"
                  className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200"
                >
                  <Gem size={10} />
                  Pro
                </Link>
              ) : (
                <span className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                  Free
                </span>
              )}
            </div>
          </div>
        </div>
        <Link
          href="/notifications"
          aria-label="Open notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:border-white/20 hover:bg-white/10 md:h-10 md:w-10"
        >
          <Bell size={16} />
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-1 text-[10px] font-semibold leading-none text-slate-950">
            {notificationCount > 99 ? "99+" : notificationCount}
          </span>
        </Link>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-1 md:overflow-visible md:pb-0">
        {links.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                navLink,
                active
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-900 shadow-[0_0_24px_rgba(245,158,11,0.12)] dark:text-amber-100"
                  : "border-zinc-200/80 bg-white/60 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400 dark:hover:border-white/15 dark:hover:bg-white/8 dark:hover:text-zinc-100"
              )}
            >
              <Icon size={16} className={active ? "text-amber-300" : "text-zinc-500"} />
              <span className="min-w-0 wrap-break-word">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={logout}
        className={cn(
          navLink,
          "mt-2 w-full border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-white/12 hover:bg-white/[0.06] hover:text-zinc-100 md:mt-4"
        )}
      >
        <LogOut size={16} className="shrink-0" aria-hidden />
        <span className="min-w-0 wrap-break-word">Logout</span>
      </button>
    </aside>
  );
}
