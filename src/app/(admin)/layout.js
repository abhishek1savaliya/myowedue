"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { clearStoredAdminProfile, readStoredAdminProfile, writeStoredAdminProfile } from "@/lib/adminClientSession";

const ROLE_BADGE = {
  superadmin: {
    label: "Super Admin",
    cls: "border border-amber-300/70 bg-amber-100/80 text-amber-800",
    active: "border-amber-300 bg-amber-100 text-amber-900",
  },
  manager: {
    label: "Manager",
    cls: "border border-sky-300/70 bg-sky-100/80 text-sky-800",
    active: "border-sky-300 bg-sky-100 text-sky-900",
  },
  support: {
    label: "Support",
    cls: "border border-emerald-300/70 bg-emerald-100/80 text-emerald-800",
    active: "border-emerald-300 bg-emerald-100 text-emerald-900",
  },
};

const ADMIN_NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/premium", label: "Premium", icon: "👑", superadminOnly: true },
  { href: "/admin/tickets", label: "Support Tickets", icon: "🎫" },
  { href: "/admin/team", label: "Team", icon: "👥" },
  { href: "/admin/chat", label: "Chat", icon: "💬" },
  { href: "/admin/vouchers", label: "Vouchers", icon: "🎟️" },
  { href: "/admin/content", label: "Content Editor", icon: "✏️" },
  { href: "/admin/profile", label: "Profile", icon: "🧾" },
];

const EMPLOYEE_NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/tickets", label: "My Tickets", icon: "🎫" },
  { href: "/admin/team", label: "Team", icon: "👥" },
  { href: "/admin/chat", label: "Chat", icon: "💬" },
  { href: "/admin/profile", label: "Profile", icon: "🧾" },
];

function SidebarContent({ admin, badge, navItems, pathname, onNavigate, onLogout, loggingOut }) {
  return (
    <>
      <div className="relative flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/8 px-4 sm:h-16 sm:px-5">
        <Link href="/admin/dashboard" className="flex min-w-0 items-center gap-2" onClick={onNavigate}>
          <span className="text-xl font-bold text-amber-400">✦</span>
          <span className="truncate font-semibold tracking-wide text-white">MyOweDue Admin</span>
        </Link>
        <button
          type="button"
          onClick={onNavigate}
          className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/5 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {admin ? (
        <div className="relative mx-3 mt-3 space-y-1 rounded-2xl border border-white/8 bg-white/4 p-3 backdrop-blur-sm sm:mt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-white">{admin.name}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <p className="truncate text-xs text-zinc-500">{admin.email}</p>
          {admin.employeeId ? <p className="font-mono text-[10px] text-zinc-400">{admin.employeeId}</p> : null}
        </div>
      ) : null}

      <nav className="relative flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? badge.active
                  : "border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/5 hover:text-zinc-100"
              }`}
            >
              <span className="text-base" aria-hidden>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="relative shrink-0 border-t border-white/8 p-3">
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {loggingOut ? "Logging out…" : "Sign out"}
        </button>
      </div>
    </>
  );
}

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const adminSessionReadyRef = useRef(false);

  useEffect(() => {
    if (pathname === "/admin/login") {
      adminSessionReadyRef.current = false;
      return;
    }
    if (adminSessionReadyRef.current) {
      return;
    }
    adminSessionReadyRef.current = true;

    const cached = readStoredAdminProfile();
    if (cached) {
      setAdmin(cached);
      return;
    }

    let cancelled = false;
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setAdmin(d);
        writeStoredAdminProfile(d);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    clearStoredAdminProfile();
    adminSessionReadyRef.current = false;
    setAdmin(null);
    setSidebarOpen(false);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const role = admin?.role || "support";
  const isAdminSide = role === "superadmin" || role === "manager";
  const navItems = isAdminSide
    ? ADMIN_NAV.filter((item) => !item.superadminOnly || role === "superadmin")
    : EMPLOYEE_NAV;
  const badge = ROLE_BADGE[role] || ROLE_BADGE.support;
  const currentPage = navItems.find((item) => pathname.startsWith(item.href))?.label ?? "Admin";

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div data-admin-panel="true" className="admin-panel flex min-h-dvh bg-slate-950">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[2px] lg:hidden"
          onClick={closeSidebar}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,18rem)] flex-col border-r border-white/8 bg-slate-950/95 shadow-[0_8px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-transform duration-300 ease-out lg:static lg:z-auto lg:w-72 lg:max-w-none lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(251,191,36,0.1),transparent_32%),radial-gradient(circle_at_90%_96%,rgba(16,185,129,0.08),transparent_38%)]" />
        <SidebarContent
          admin={admin}
          badge={badge}
          navItems={navItems}
          pathname={pathname}
          onNavigate={closeSidebar}
          onLogout={handleLogout}
          loggingOut={loggingOut}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-950 text-slate-100">
        <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/90 px-4 backdrop-blur-md sm:min-h-[3.5rem] sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-slate-200 hover:border-slate-600 hover:bg-slate-800 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-white sm:text-base">{currentPage}</h2>
              <p className="truncate text-[11px] text-slate-500 sm:text-xs">
                {isAdminSide ? "Admin panel" : "Employee panel"}
              </p>
            </div>
          </div>
          {admin ? (
            <div className="flex max-w-[50%] shrink-0 items-center gap-2">
              <span className={`hidden rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline ${badge.cls}`}>
                {badge.label}
              </span>
              <span className="truncate text-xs font-medium text-slate-300 sm:text-sm">{admin.name}</span>
            </div>
          ) : null}
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
