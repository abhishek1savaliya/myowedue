"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { clearStoredAdminProfile, readStoredAdminProfile, writeStoredAdminProfile } from "@/lib/adminClientSession";

const ROLE_BADGE = {
  superadmin: {
    label: "Super Admin",
    cls: "border border-amber-300/70 bg-amber-100/80 text-amber-800",
    panel: "from-amber-500/15 to-orange-500/10",
    active: "border-amber-300 bg-amber-100 text-amber-900",
  },
  manager: {
    label: "Manager",
    cls: "border border-sky-300/70 bg-sky-100/80 text-sky-800",
    panel: "from-cyan-500/15 to-blue-500/10",
    active: "border-sky-300 bg-sky-100 text-sky-900",
  },
  support: {
    label: "Support",
    cls: "border border-emerald-300/70 bg-emerald-100/80 text-emerald-800",
    panel: "from-emerald-500/15 to-teal-500/10",
    active: "border-emerald-300 bg-emerald-100 text-emerald-900",
  },
};

// Static nav groups
const ADMIN_NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
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

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [admin, setAdmin] = useState(null);
  /** Once true for a logged-in shell, we keep using React state + session cache — no refetch on each route. */
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

  async function handleLogout() {
    setLoggingOut(true);
    clearStoredAdminProfile();
    adminSessionReadyRef.current = false;
    setAdmin(null);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const role = admin?.role || "support";
  const isAdminSide = role === "superadmin" || role === "manager";
  const navItems = isAdminSide ? ADMIN_NAV : EMPLOYEE_NAV;
  const badge = ROLE_BADGE[role] || ROLE_BADGE.support;

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className="relative flex w-72 flex-col border-r border-white/[0.08] bg-slate-950/90 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(251,191,36,0.1),transparent_32%),radial-gradient(circle_at_90%_96%,rgba(16,185,129,0.08),transparent_38%)]" />
        {/* Logo */}
        <div className="relative flex h-16 items-center gap-2 border-b border-white/[0.08] px-5">
          <span className="text-xl font-bold text-amber-400">✦</span>
          <span className="font-semibold tracking-wide text-white">MyOweDue Admin</span>
        </div>

        {/* User info card */}
        {admin && (
          <div className="relative mx-3 mt-4 space-y-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm font-semibold text-white">{admin.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
            <p className="truncate text-xs text-zinc-500">{admin.email}</p>
            {admin.employeeId && (
              <p className="font-mono text-[10px] text-zinc-400">{admin.employeeId}</p>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="relative flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? badge.active
                  : "border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/5 hover:text-zinc-100"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        {/* Logout */}
        <div className="relative border-t border-white/[0.08] p-3">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm font-medium text-zinc-300 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-200"
          >
            <span>x</span>
            {loggingOut ? "Logging out..." : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-950 text-slate-100">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/70 px-6 backdrop-blur-sm">
          <h2 className="text-sm font-medium capitalize text-slate-200">
            {isAdminSide ? "Admin Panel" : "Employee Panel"}
          </h2>
          {admin && (
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className={`rounded-full px-2.5 py-1 font-semibold ${badge.cls}`}>
                {badge.label}
              </span>
              <span>{admin.name}</span>
            </div>
          )}
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
