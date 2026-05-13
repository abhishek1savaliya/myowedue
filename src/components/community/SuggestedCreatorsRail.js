"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, UserRound } from "lucide-react";
import { COMMUNITY_MUTATE_EVENT, dispatchCommunityMutate } from "@/lib/community-mutate-event";

/**
 * Right-rail: suggested community profiles to follow.
 * @param {{ loggedIn: boolean; authChecked: boolean; className?: string }} props
 */
export default function SuggestedCreatorsRail({ loggedIn, authChecked, className = "" }) {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const debounceRef = useRef(null);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch("/api/community/suggested-creators?limit=3", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreators([]);
        return;
      }
      setCreators(Array.isArray(data.creators) ? data.creators : []);
    } catch {
      setCreators([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleRefetch = useCallback(() => {
    if (typeof window === "undefined") return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void fetchList();
    }, 500);
  }, [fetchList]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = () => scheduleRefetch();
    window.addEventListener(COMMUNITY_MUTATE_EVENT, handler);
    return () => {
      window.removeEventListener(COMMUNITY_MUTATE_EVENT, handler);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [scheduleRefetch]);

  async function toggleFollow(username, userId) {
    if (!loggedIn || !username || busyId) return;
    setBusyId(userId);
    const prev = creators.map((c) => ({ ...c }));
    setCreators((list) =>
      list.map((c) => (c.user_id === userId ? { ...c, viewer_follows: !c.viewer_follows } : c))
    );
    try {
      const res = await fetch(`/api/community/profile/${encodeURIComponent(username)}/follow`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed");
      const following = Boolean(data.following);
      setCreators((list) => list.map((c) => (c.user_id === userId ? { ...c, viewer_follows: following } : c)));
      dispatchCommunityMutate();
    } catch {
      setCreators(prev);
    } finally {
      setBusyId("");
    }
  }

  const cardClass =
    "rounded-xl border border-zinc-200 bg-white/95 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90";

  return (
    <section className={`${cardClass} ${className}`.trim()} aria-labelledby="suggested-creators-heading">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <h2 id="suggested-creators-heading" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Popular to follow
        </h2>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : creators.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">No suggestions yet — post and follow others to grow the network.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {creators.map((c) => {
            const href = `/community/user/${encodeURIComponent(c.username)}`;
            const initial = String(c.display_name || c.username || "?").trim().slice(0, 1).toUpperCase();
            return (
              <li key={c.user_id} className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-700/80 dark:bg-zinc-950/50">
                <div className="flex gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    aria-hidden
                  >
                    {initial ? (
                      initial
                    ) : (
                      <UserRound className="h-5 w-5 text-zinc-500" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={href} className="block font-semibold text-zinc-900 hover:underline dark:text-zinc-100">
                      {c.display_name}
                    </Link>
                    <Link href={href} className="mt-0.5 block text-xs text-zinc-600 hover:underline dark:text-zinc-400">
                      @{c.username}
                    </Link>
                  </div>
                </div>
                <div className="mt-3">
                  {!authChecked ? (
                    <div className="h-9 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
                  ) : loggedIn ? (
                    <button
                      type="button"
                      onClick={() => void toggleFollow(c.username, c.user_id)}
                      disabled={Boolean(busyId)}
                      className={`inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                        c.viewer_follows
                          ? "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                          : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                      }`}
                    >
                      {busyId === c.user_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : c.viewer_follows ? (
                        "Following"
                      ) : (
                        "Follow"
                      )}
                    </button>
                  ) : (
                    <Link
                      href={`/login?next=${encodeURIComponent(href)}`}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    >
                      Sign in to follow
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
