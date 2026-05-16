"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shown in the post like section for Pro users with private likes enabled.
 * @param {{ className?: string; upgradeHref?: string; showUpgradeHint?: boolean }} props
 */
export default function CommunityLikesPrivateBanner({
  className = "",
  upgradeHref = "/my-subscription?purchase=1",
  showUpgradeHint = false,
}) {
  if (showUpgradeHint) {
    return (
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5",
          className
        )}
      >
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <p className="text-sm leading-snug text-zinc-700 dark:text-zinc-300">
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">Pro:</span> hide your likes from others.{" "}
          <Link href={upgradeHref} className="font-semibold text-amber-700 underline underline-offset-2 dark:text-amber-300">
            Upgrade to Pro
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2.5 dark:border-white/10 dark:bg-zinc-950/50",
        className
      )}
      role="status"
    >
      <Lock className="h-4 w-4 shrink-0 text-zinc-300" aria-hidden />
      <p className="text-sm font-medium text-zinc-200">Your likes are private. Only you can see them.</p>
    </div>
  );
}
