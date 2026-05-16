import Link from "next/link";
import { Award, Bell, Scale, Search, Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const TRUST_BADGES = [
  { icon: Shield, label: "Bank-level security" },
  { icon: Bell, label: "Smart reminders" },
  { icon: Scale, label: "Credit & debit tracking" },
  { icon: Users, label: "Community insights" },
  { icon: Award, label: "Your data, your control" },
];

/**
 * @param {{ variant?: "default" | "landing" }} props
 */
export default function PublicFooter({ variant = "default" }) {
  const year = new Date().getFullYear();
  const isLanding = variant === "landing";

  return (
    <footer
      className={cn(
        isLanding
          ? "border-t border-zinc-200 bg-zinc-100 text-foreground dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100"
          : "bg-[#121619] text-white"
      )}
    >
      <div className="mx-auto max-w-6xl px-6 pb-10 pt-14 sm:px-8 sm:pb-12 sm:pt-16">
        <form action="/community/search" method="get" className="mx-auto mb-12 max-w-md" role="search">
          <label htmlFor="footer-community-search" className="sr-only">
            Search community members
          </label>
          <div
            className={cn(
              "flex items-center gap-3 rounded-full px-5 py-3 ring-1",
              isLanding
                ? "bg-white shadow-[0_8px_28px_rgba(0,0,0,0.08)] ring-zinc-200 dark:bg-[#1f1f23] dark:shadow-[0_8px_28px_rgba(0,0,0,0.45)] dark:ring-white/6"
                : "bg-[#1f1f23] shadow-[0_8px_28px_rgba(0,0,0,0.45)] ring-white/6"
            )}
          >
            <Search
              className={cn("h-4 w-4 shrink-0", isLanding ? "text-zinc-500 dark:text-[#8e8e93]" : "text-[#8e8e93]")}
              strokeWidth={2}
              aria-hidden
            />
            <input
              id="footer-community-search"
              type="search"
              name="q"
              placeholder="Search"
              autoComplete="off"
              className={cn(
                "min-w-0 flex-1 bg-transparent text-sm outline-none",
                isLanding
                  ? "text-zinc-900 placeholder:text-zinc-500 dark:text-zinc-200 dark:placeholder:text-[#8e8e93]"
                  : "text-zinc-200 placeholder:text-[#8e8e93]"
              )}
            />
          </div>
        </form>

        <div
          className={cn(
            "grid grid-cols-1 gap-8 border-b pb-12 sm:grid-cols-2 sm:pb-14 lg:flex lg:flex-nowrap lg:items-center lg:justify-between lg:gap-6",
            isLanding ? "border-zinc-200 dark:border-white/10" : "border-white/10"
          )}
        >
          {TRUST_BADGES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex min-w-0 items-center gap-3 lg:max-w-[11rem] lg:flex-1 xl:max-w-none">
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1",
                  isLanding
                    ? "bg-zinc-200 text-zinc-700 ring-zinc-300 dark:bg-zinc-800/90 dark:text-zinc-300 dark:ring-white/10"
                    : "bg-zinc-800/90 text-zinc-300 ring-white/10"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <p
                className={cn(
                  "text-[11px] font-bold uppercase leading-snug tracking-[0.12em] sm:text-xs",
                  isLanding ? "text-zinc-800 dark:text-white" : "text-white"
                )}
              >
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-5 text-sm sm:mt-12 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <p className={cn(isLanding ? "text-zinc-600" : "text-zinc-500")}>
            © {year}{" "}
            <span className={cn("font-semibold", isLanding ? "text-zinc-900 dark:text-white" : "text-white")}>
              MyOwedue
            </span>
            . All rights reserved.
          </p>
          <nav
            className={cn(
              "flex flex-wrap items-center gap-x-6 gap-y-2 font-medium",
              isLanding ? "text-zinc-700 dark:text-white" : "text-white"
            )}
          >
            <Link
              href="/contact-us"
              className={cn(
                "transition",
                isLanding ? "hover:text-zinc-900 dark:hover:text-zinc-300" : "hover:text-zinc-300"
              )}
            >
              Legal info
            </Link>
            <Link
              href="/privacy-policy"
              className={cn(
                "transition",
                isLanding ? "hover:text-zinc-900 dark:hover:text-zinc-300" : "hover:text-zinc-300"
              )}
            >
              Privacy policy
            </Link>
            <Link
              href="/contact-us"
              className={cn(
                "transition",
                isLanding ? "hover:text-zinc-900 dark:hover:text-zinc-300" : "hover:text-zinc-300"
              )}
            >
              Do not sell my personal info
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
