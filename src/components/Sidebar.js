"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { LayoutDashboard, Users, ArrowLeftRight, FileText, Settings, Bell, Trash2, FilePenLine, CalendarDays } from "lucide-react";

const baseLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/people", label: "People", icon: Users },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/bin", label: "Bin", icon: Trash2 },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ notificationCount = 0 }) {
  const pathname = usePathname();
  const router = useRouter();
  const [liveNotificationCount, setLiveNotificationCount] = useState(notificationCount);
  const [canAccessContentEditor, setCanAccessContentEditor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let socket = null;

    async function loadNotificationCount() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setLiveNotificationCount(Number(data.notificationCount || 0));
        }
      } catch {
        // Keep existing count if request fails.
      }
    }

    async function setupSocket() {
      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        const meData = await meRes.json().catch(() => ({}));
        const meUser = meData?.user || {};
        const userId = meUser?.id;
        const role = String(meUser?.cmsRole || "");
        const hasPermission =
          role === "super_admin" ||
          (role === "manager" && Boolean(meUser?.contentEditPermission));
        if (!cancelled) {
          setCanAccessContentEditor(hasPermission);
        }
        if (!userId || cancelled) return;

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4001";
        socket = io(socketUrl, { transports: ["websocket", "polling"] });

        socket.on("connect", () => {
          socket.emit("join", { userId });
        });

        socket.on("notification:update", () => {
          loadNotificationCount();
        });
      } catch {
        // Ignore realtime setup failures and keep fallback polling behavior.
      }
    }

    loadNotificationCount();
    setupSocket();
    return () => {
      cancelled = true;
      if (socket) socket.disconnect();
    };
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const links = canAccessContentEditor
    ? [...baseLinks, { href: "/content-editor", label: "Content Editor", icon: FilePenLine }]
    : baseLinks;

  return (
    <aside className="sticky top-0 z-30 w-full border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:h-screen md:w-72 md:border-b-0 md:border-r md:px-6 md:py-8">
      <div className="mb-4 flex items-center justify-between md:mb-8">
        <Link href="/dashboard" className="inline-flex min-w-0 items-center gap-2 rounded-xl p-1" aria-label="Go to dashboard">
          <Image
            src="/owedue-logo.svg"
            alt="OWE DUE logo"
            width={40}
            height={40}
            priority
            className="h-8 w-8 rounded-lg sm:h-9 sm:w-9 md:h-10 md:w-10"
          />
          <span className="truncate text-base font-bold tracking-widest text-black sm:text-lg md:text-xl">OWE DUE</span>
        </Link>
        <Link
          href="/notifications"
          aria-label="Open notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 transition hover:border-black hover:text-black md:h-10 md:w-10"
        >
          <Bell size={16} />
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold leading-none text-white">
            {liveNotificationCount > 99 ? "99+" : liveNotificationCount}
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
              className={`group flex min-w-33 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition md:min-w-0 md:justify-start md:gap-3 md:py-3 md:text-sm ${
                active
                  ? "border-black bg-black text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-black hover:text-black"
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        onClick={logout}
        className="mt-4 hidden w-full rounded-xl border border-black px-3 py-2.5 text-sm font-medium text-black transition hover:bg-black hover:text-white md:mt-8 md:block md:py-3"
      >
        Logout
      </button>
    </aside>
  );
}
