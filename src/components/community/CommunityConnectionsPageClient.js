"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

/**
 * Dedicated followers/following page for a profile.
 * @param {{ username: string; mode: "followers" | "following" }} props
 */
export default function CommunityConnectionsPageClient({ username, mode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [list, setList] = useState([]);
  const [hidden, setHidden] = useState(false);

  const title = mode === "followers" ? "Followers" : "Following";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/community/profile/${encodeURIComponent(username)}/connections`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.message || "Could not load connections.");
          return;
        }
        setHidden(Boolean(data.hidden));
        const source = mode === "followers" ? data.followers : data.following;
        setList(Array.isArray(source) ? source : []);
      } catch {
        if (!cancelled) setError("Could not load connections.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username, mode]);

  const profileHref = useMemo(() => `/community/user/${encodeURIComponent(username)}`, [username]);

  return (
    <div className="min-h-0 bg-background">
      <div className="border-b border-zinc-200/90 bg-white/90 px-4 py-3 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-950/90">
        <Link
          href={profileHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to profile
        </Link>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {title} <span className="text-zinc-500">({list.length})</span>
        </h1>

        {loading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading {title.toLowerCase()}…
          </p>
        ) : error ? (
          <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>
        ) : hidden ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">This profile is private.</p>
        ) : list.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">No {title.toLowerCase()} yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {list.map((u) => (
              <Link
                key={u.id}
                href={`/community/user/${encodeURIComponent(u.username)}`}
                className="block rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/80 dark:hover:bg-zinc-800"
              >
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{u.displayName}</span>{" "}
                <span className="text-zinc-500 dark:text-zinc-400">@{u.username}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

