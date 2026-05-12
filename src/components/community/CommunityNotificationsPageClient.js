"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Bell, Loader2, X } from "lucide-react";
import { io } from "socket.io-client";
import { COMMUNITY_POST_NOTIFICATION_TYPES } from "@/lib/community-post-notification-types";

const POST_TYPES = new Set(COMMUNITY_POST_NOTIFICATION_TYPES);

export default function CommunityNotificationsPageClient() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data?.user) setLoggedIn(true);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!loggedIn) {
      setLoading(false);
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?scope=community", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setItems([]);
        return;
      }
      setEnabled(data.notificationsEnabled !== false);
      const raw = Array.isArray(data.notifications) ? data.notifications : [];
      setItems(raw.filter((n) => POST_TYPES.has(String(n.type || ""))));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [loggedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loggedIn) return undefined;
    let cancelled = false;
    let socket = null;

    async function setupSocket() {
      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        const meData = await meRes.json().catch(() => ({}));
        const userId = meData?.user?.id;
        if (!userId || cancelled) return;

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4001";
        socket = io(socketUrl, { transports: ["websocket", "polling"] });

        socket.on("connect", () => {
          socket.emit("join", { userId });
        });

        socket.on("notification:update", () => {
          void load();
        });
      } catch {
        /* ignore */
      }
    }

    void setupSocket();
    return () => {
      cancelled = true;
      if (socket) socket.disconnect();
    };
  }, [loggedIn, load]);

  async function dismiss(id) {
    const previous = items;
    setItems((list) => list.filter((n) => n._id !== id));
    const res = await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) setItems(previous);
  }

  function notificationTypeLabel(type) {
    return String(type || "notification").replaceAll("community_", "").replaceAll("_", " ");
  }

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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Community Notifications</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Likes, comments, shares, and follows.</p>
          </div>
          {authChecked && loggedIn && items.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              <Bell className="h-3.5 w-3.5" aria-hidden />
              {items.length}
            </span>
          ) : null}
        </div>

        {!authChecked ? (
          <div className="mt-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        ) : !loggedIn ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/80">
            <Bell className="mx-auto h-8 w-8 text-zinc-400" />
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Sign in to see your community notifications.
            </p>
            <Link
              href="/login?next=/community/notifications"
              className="mt-4 inline-flex rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
            >
              Log in
            </Link>
          </div>
        ) : !enabled ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/80">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Notifications are turned off in{" "}
              <Link href="/settings" className="font-medium text-amber-800 underline dark:text-amber-400">
                Settings
              </Link>
              .
            </p>
          </div>
        ) : loading ? (
          <div className="mt-8 flex items-center justify-center gap-2 py-10 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading notifications...
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/80">
            <Bell className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No community notifications yet.</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              You will see likes, comments, shares, and follows here.
            </p>
          </div>
        ) : (
          <section className="mt-5 space-y-2.5">
            {items.map((n) => {
              const postId =
                n.meta && typeof n.meta.postId === "string"
                  ? n.meta.postId
                  : n.meta?.postId
                    ? String(n.meta.postId)
                    : "";
              const actorCommunityUsername =
                n.type === "community_follow" && n.meta && typeof n.meta.actorCommunityUsername === "string"
                  ? n.meta.actorCommunityUsername
                  : "";
              const profileHref = actorCommunityUsername
                ? `/community/user/${encodeURIComponent(actorCommunityUsername)}`
                : "";
              const linkHref = postId ? `/community/post/${encodeURIComponent(postId)}` : profileHref || "";
              const created = n.createdAt ? new Date(n.createdAt) : null;

              return (
                <article
                  key={String(n._id)}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/80"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {linkHref ? (
                        <Link href={linkHref} className="block hover:opacity-90">
                          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{n.title}</h2>
                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{n.message}</p>
                        </Link>
                      ) : (
                        <>
                          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{n.title}</h2>
                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{n.message}</p>
                        </>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-400">
                          {notificationTypeLabel(n.type)}
                        </span>
                        {created && !Number.isNaN(created.getTime()) ? (
                          <span className="text-xs text-zinc-400 dark:text-zinc-500">
                            {formatDistanceToNow(created, { addSuffix: true })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void dismiss(n._id)}
                      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      aria-label="Dismiss notification"
                    >
                      <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/notifications"
            className="text-sm font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-400"
          >
            View all notifications (app)
          </Link>
        </div>
      </div>
    </div>
  );
}
