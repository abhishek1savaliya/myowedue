"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import PublicModeToggle from "@/components/PublicModeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "Workflow" },
  { href: "#security", label: "Security" },
  { href: "#pricing", label: "Pricing" },
  { href: "/community", label: "Community" },
];

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let raf = 0;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setScrolled(window.scrollY > 12);
      });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header className="landing-nav-enter fixed inset-x-0 top-0 z-50 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
      <nav
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl border px-4 py-2.5 transition-[background-color,border-color,box-shadow] duration-200 sm:px-5",
          scrolled
            ? "border-zinc-200/90 bg-background/95 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-slate-950/92 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            : "border-transparent bg-transparent"
        )}
        aria-label="Primary"
      >
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Image src="/owedue-logo.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" priority />
          <span className="text-sm font-semibold tracking-tight text-foreground sm:text-base">OWE DUE</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <PublicModeToggle />
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">Create account</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
