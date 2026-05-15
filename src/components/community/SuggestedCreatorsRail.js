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
    "rounded-xl border border-white/10 bg-slate-950/80 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.22)]";

  return (
    <section className={`${cardClass} ${className}`.trim()} aria-labelledby="suggested-creators-heading">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 shrink-0 text-amber-400/90" aria-hidden />
        <h2 id="suggested-creators-heading" className="text-base font-semibold text-zinc-50">
          Popular to follow
        </h2>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : creators.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-400">No suggestions yet — post and follow others to grow the network.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {creators.map((c) => {
            const href = `/community/user/${encodeURIComponent(c.username)}`;
            const initial = String(c.display_name || c.username || "?").trim().slice(0, 1).toUpperCase();
            return (
              <li key={c.user_id} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                <div className="flex gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-zinc-200"
                    aria-hidden
                  >
                    {initial ? (
                      initial
                    ) : (
                      <UserRound className="h-5 w-5 text-zinc-500" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={href} className="block font-semibold text-zinc-100 hover:underline">
                      {c.display_name}
                    </Link>
                    <Link href={href} className="mt-0.5 block text-xs text-zinc-400 hover:underline">
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
                          ? "border border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
                          : "bg-amber-500 text-slate-950 hover:bg-amber-400"
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
                      className="inline-flex w-full items-center justify-center rounded-lg bg-amber-500 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400"
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
