"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import TrendingTopicsFromApi from "@/components/community/TrendingTopicsFromApi";

export default function CommunityTrendingPageClient() {
  return (
    <div className="mx-auto max-w-xl px-3 py-4 md:px-4 md:py-6">
      <Link
        href="/community"
        className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        Back to feed
      </Link>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Trending</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Last 24 hours · by engagement. Tap a topic to open posts tagged with that topic.
      </p>
      <div className="mt-6">
        <TrendingTopicsFromApi limit={10} variant="shell" linkBasePath="/community" />
      </div>
    </div>
  );
}
