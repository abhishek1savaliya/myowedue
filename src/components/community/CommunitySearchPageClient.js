"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Search, X } from "lucide-react";
import { normalizeSavedUsernameHandle, tryNormalizeCommunityUsername } from "@/lib/community-usernames";

const STORAGE_KEY = "owedue.community.searchRecent";
const MAX_RECENT = 10;
const SUGGEST_DEBOUNCE_MS = 280;

function readRecent() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeRecent(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

function suggestPrefix(raw) {
  return normalizeSavedUsernameHandle(raw).replace(/[^a-z0-9_]/g, "");
}

export default function CommunitySearchPageClient() {
  const router = useRouter();
  const inputRef = useRef(null);
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState([]);
  const [matches, setMatches] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  useEffect(() => {
    setRecent(readRecent());
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const prefix = suggestPrefix(q);
    if (prefix.length < 1) {
      setMatches([]);
      setSuggestLoading(false);
      return;
    }

    const ac = new AbortController();
    const t = window.setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res = await fetch(`/api/community/username/suggest?q=${encodeURIComponent(prefix)}`, {
          signal: ac.signal,
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMatches([]);
          return;
        }
        setMatches(Array.isArray(data.matches) ? data.matches : []);
      } catch (e) {
        if (e?.name === "AbortError") return;
        setMatches([]);
      } finally {
        setSuggestLoading(false);
      }
    }, SUGGEST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [q]);

  const addRecentSafe = useCallback((raw) => {
    const norm = tryNormalizeCommunityUsername(normalizeSavedUsernameHandle(raw));
    if (!norm.ok) return;
    const u = norm.normalized;
    setRecent((prev) => {
      const next = [u, ...prev.filter((x) => x !== u)].slice(0, MAX_RECENT);
      writeRecent(next);
      return next;
    });
  }, []);

  function removeRecent(u) {
    setRecent((prev) => {
      const next = prev.filter((x) => x !== u);
      writeRecent(next);
      return next;
    });
  }

  function clearAll() {
    setRecent([]);
    writeRecent([]);
  }

  function goToUser(username) {
    router.push(`/community/user/${encodeURIComponent(username)}`);
  }

  function pickMatch(username) {
    addRecentSafe(username);
    goToUser(username);
  }

  function onSubmit(e) {
    e.preventDefault();
    const s = normalizeSavedUsernameHandle(q);
    const norm = tryNormalizeCommunityUsername(s);
    if (!norm.ok) return;
    addRecentSafe(q);
    goToUser(norm.normalized);
  }

  const prefixLen = suggestPrefix(q).length;
  const showMatches = prefixLen >= 1;

  return (
    <div className="min-h-0 bg-background">
      <div className="border-b border-zinc-200/90 bg-white/90 px-4 py-3 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-950/90">
        <Link
          href="/community"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to community
        </Link>
      </div>

      <div className="mx-auto max-w-xl px-4 py-5 sm:px-6">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Search Members</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Find community members by @username.</p>

        <form onSubmit={onSubmit} className="mt-5">
          <label htmlFor="community-search-page" className="sr-only">
            Search by @username
          </label>
          <div className="flex items-center gap-2.5 rounded-xl border border-zinc-300 bg-white px-4 py-3 shadow-sm transition focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-300/50 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-within:border-zinc-400 dark:focus-within:ring-zinc-500/30">
            <Search className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
            <input
              ref={inputRef}
              id="community-search-page"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type a @username..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            {q ? (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setMatches([]);
                  inputRef.current?.focus();
                }}
                className="shrink-0 rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            ) : null}
          </div>
        </form>

        {showMatches ? (
          <section className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Matches</h2>
              {suggestLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-label="Searching" />
              ) : null}
            </div>
            {matches.length === 0 && !suggestLoading ? (
              <p className="mt-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No members match that handle.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {matches.map((u) => (
                  <li key={u}>
                    <button
                      type="button"
                      onClick={() => pickMatch(u)}
                      className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/80 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {u.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="min-w-0 truncate font-medium text-zinc-900 dark:text-zinc-100">@{u}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <section className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent Searches</h2>
            {recent.length > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-semibold text-amber-700 transition hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
              >
                Clear all
              </button>
            ) : null}
          </div>
          {recent.length === 0 ? (
            <p className="mt-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No recent searches. Search for a member by @username above.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {recent.map((u) => (
                <li key={u} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => pickMatch(u)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/80 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                  >
                    <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
                    <span className="min-w-0 truncate font-medium text-zinc-900 dark:text-zinc-100">@{u}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRecent(u)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    aria-label={`Remove @${u}`}
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
