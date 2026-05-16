"use client";

import dynamic from "next/dynamic";
import { landingTrendingWrap } from "@/lib/landing-classes";

const HomeTrendingSection = dynamic(() => import("@/components/HomeTrendingSection"), {
  loading: () => (
    <div
      className="min-h-[200px] animate-pulse rounded-xl border border-zinc-200/80 bg-zinc-100/80 dark:border-white/10 dark:bg-white/5"
      aria-hidden
    />
  ),
  ssr: false,
});

export default function LandingTrendingBlock() {
  return (
    <div className={landingTrendingWrap}>
      <HomeTrendingSection variant="landing" />
    </div>
  );
}
