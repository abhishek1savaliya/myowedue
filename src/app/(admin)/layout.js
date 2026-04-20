"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const ROLE_BADGE = {
  superadmin: {
    label: "Super Admin",
    cls: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    panel: "from-amber-500/15 to-orange-500/10",
    active: "bg-amber-400/20 text-amber-200 border-amber-400/40",
  },
  manager: {
    label: "Manager",
    cls: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
    panel: "from-cyan-500/15 to-blue-500/10",
    active: "bg-cyan-400/20 text-cyan-200 border-cyan-400/40",
  },
  support: {
    label: "Support",
    cls: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    panel: "from-emerald-500/15 to-teal-500/10",
    active: "bg-emerald-400/20 text-emerald-200 border-emerald-400/40",
  },
};

// Static nav groups
const ADMIN_NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/tickets", label: "Support Tickets", icon: "🎫" },
  { href: "/admin/team", label: "Team", icon: "👥" },
  { href: "/admin/content", label: "Content Editor", icon: "✏️" },
  { href: "/admin/profile", label: "Profile", icon: "🧾" },
];

const EMPLOYEE_NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/tickets", label: "My Tickets", icon: "🎫" },
  { href: "/admin/profile", label: "Profile", icon: "🧾" },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    fetch("/api/admin/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setAdmin(d))
      .catch(() => {});
  }, [pathname]);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const role = admin?.role || "support";
  const isAdminSide = role === "superadmin";
  const navItems = isAdminSide ? ADMIN_NAV : EMPLOYEE_NAV;
  const badge = ROLE_BADGE[role] || ROLE_BADGE.support;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="relative flex w-64 flex-col border-r border-slate-800 bg-slate-900">
        <div className={`pointer-events-none absolute inset-0 bg-linear-to-b ${badge.panel}`} />
        {/* Logo */}
        <div className="relative flex h-16 items-center gap-2 px-5 border-b border-slate-800">
          <span className="text-cyan-300 text-xl font-bold">#</span>
          <span className="font-semibold text-white tracking-wide">MyOweDue Admin</span>
        </div>

        {/* User info card */}
        {admin && (
          <div className="relative mx-3 mt-4 rounded-xl bg-slate-900/70 border border-slate-700/80 p-3 space-y-1 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white truncate">{admin.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">{admin.email}</p>
            {admin.employeeId && (
              <p className="font-mono text-[10px] text-slate-500">{admin.employeeId}</p>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="relative flex-1 py-4 space-y-1 px-3">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? badge.active
                  : "border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        {/* Logout */}
        <div className="relative p-3 border-t border-slate-800">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full rounded-xl border border-slate-700 px-3 py-2.5 text-sm font-medium text-slate-300 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 transition-colors text-left flex items-center gap-2"
          >
            <span>x</span>
            {loggingOut ? "Logging out..." : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/50 px-6">
          <h2 className="text-sm font-medium text-slate-300 capitalize">
            {isAdminSide ? "Admin Panel" : "Employee Panel"}
          </h2>
          {admin && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
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
