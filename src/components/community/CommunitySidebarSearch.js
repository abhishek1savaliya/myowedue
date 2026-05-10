"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
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

export default function CommunitySidebarSearch() {
  const router = useRouter();
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState([]);
  const [matches, setMatches] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  useEffect(() => {
    if (!open) return;
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
  }, [q, open]);

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
    setOpen(false);
    setQ("");
    setMatches([]);
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

  useEffect(() => {
    if (!open) return;
    function onDocDown(ev) {
      if (rootRef.current && !rootRef.current.contains(ev.target)) {
        setOpen(false);
      }
    }
    function onKey(ev) {
      if (ev.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const prefixLen = suggestPrefix(q).length;
  const showMatches = prefixLen >= 1;

  return (
    <div ref={rootRef} className="relative mt-2">
      <form onSubmit={onSubmit}>
        <label htmlFor="community-sidebar-search" className="sr-only">
          Search community by @username
        </label>
        <div className="flex items-center gap-2 rounded-full border border-zinc-500/80 bg-zinc-800 px-3 py-2.5 shadow-sm transition-[box-shadow,border-color] focus-within:border-amber-500/70 focus-within:ring-2 focus-within:ring-amber-400/35 dark:border-zinc-600 dark:bg-zinc-800">
          <Search className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
          <input
            ref={inputRef}
            id="community-sidebar-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-400"
          />
        </div>
      </form>

      {open ? (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:border-zinc-600 dark:bg-zinc-900"
          role="region"
          aria-label="Member search and recent profile searches"
        >
          {showMatches ? (
            <>
              <div className="flex min-h-11 items-center justify-between gap-2 border-b border-zinc-200/90 px-3 py-2 dark:border-zinc-700">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Matches</span>
                {suggestLoading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" aria-label="Loading matches" />
                ) : null}
              </div>
              {matches.length === 0 && !suggestLoading ? (
                <p className="px-3 py-3 text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  No members match that handle.
                </p>
              ) : (
                <ul className="max-h-44 overflow-y-auto py-1.5">
                  {matches.map((u) => (
                    <li key={u} className="px-1.5">
                      <button
                        type="button"
                        onClick={() => pickMatch(u)}
                        className="flex w-full items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50/90 px-2.5 py-2 text-left text-sm text-zinc-900 transition hover:border-zinc-200 hover:bg-zinc-100/90 dark:border-zinc-700/80 dark:bg-zinc-800/50 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                      >
                        <Search className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />
                        <span className="truncate font-medium">@{u}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-zinc-200/90 dark:border-zinc-700" aria-hidden />
            </>
          ) : null}

          <div className="flex min-h-11 items-center justify-between gap-2 border-b border-zinc-200/90 px-3 py-2 dark:border-zinc-700">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Recent</span>
            {recent.length > 0 ? (
              <button
                type="button"
                onClick={() => clearAll()}
                className="shrink-0 text-xs font-semibold text-amber-700 transition hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
              >
                Clear all
              </button>
            ) : null}
          </div>
          {recent.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {showMatches
                ? "No recent searches yet."
                : "Search for a member by @username. Recent searches will show here."}
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto py-1">
              {recent.map((u) => (
                <li key={u} className="group flex items-center gap-1 px-1">
                  <button
                    type="button"
                    onClick={() => pickMatch(u)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-zinc-900 transition hover:bg-zinc-200/60 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Search className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />
                    <span className="truncate font-medium">@{u}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeRecent(u);
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-amber-700 opacity-80 transition hover:bg-zinc-200/80 hover:opacity-100 dark:text-amber-400 dark:hover:bg-zinc-800"
                    aria-label={`Remove @${u} from recent`}
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
