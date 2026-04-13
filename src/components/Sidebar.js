"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, ArrowLeftRight, FileText, Settings, Bell, Trash2 } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/people", label: "People", icon: Users },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/bin", label: "Bin", icon: Trash2 },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ notificationCount = 0 }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="sticky top-0 z-30 w-full border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:h-screen md:w-72 md:border-b-0 md:border-r md:px-6 md:py-8">
      <div className="mb-4 flex items-center justify-between md:mb-8 md:block">
        <h1 className="text-xl font-bold tracking-[0.18em] text-black">OWE DUE</h1>
        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-1 text-xs text-zinc-700">
          <Bell size={14} /> {notificationCount}
        </span>
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
        className="mt-4 w-full rounded-xl border border-black px-3 py-2.5 text-sm font-medium text-black transition hover:bg-black hover:text-white md:mt-8 md:py-3"
      >
        Logout
      </button>
    </aside>
  );
}
