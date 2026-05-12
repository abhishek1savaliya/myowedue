"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bell, Loader2, X } from "lucide-react";
import { io } from "socket.io-client";
import { COMMUNITY_POST_NOTIFICATION_TYPES } from "@/lib/community-post-notification-types";

const POST_TYPES = new Set(COMMUNITY_POST_NOTIFICATION_TYPES);

/**
 * Left-rail list of community post/thread notifications only (likes, shares, comments).
 * @param {{ loggedIn: boolean; appearance?: "default" | "onDark" }} props
 */
export default function CommunityNotificationsSidebar({ loggedIn, authChecked = true, appearance = "default" }) {
  const onDark = appearance === "onDark";
  const headingId = useId();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);

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
    }

    void setupSocket();

    return () => {
      cancelled = true;
      if (socket) socket.disconnect();
    };
  }, [loggedIn, load]);

  async function dismiss(id, e) {
    e.preventDefault();
    e.stopPropagation();
    const previous = items;
    setItems((list) => list.filter((n) => n._id !== id));
    const res = await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) setItems(previous);
  }

  const muted = onDark ? "text-zinc-500" : "text-zinc-500 dark:text-zinc-400";
  const headingIcon = onDark ? "text-zinc-500" : "text-zinc-500 dark:text-zinc-400";
  const titleCls = onDark
    ? "text-[12px] font-semibold leading-snug text-white"
    : "text-[12px] font-semibold leading-snug text-zinc-900 dark:text-zinc-50";
  const msgCls = onDark
    ? "mt-0.5 line-clamp-3 text-[11px] leading-snug text-zinc-400"
    : "mt-0.5 line-clamp-3 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400";
  const timeCls = onDark ? "mt-1 text-[10px] text-zinc-500" : "mt-1 text-[10px] text-zinc-400 dark:text-zinc-500";
  const cardCls = onDark
    ? "rounded-lg border border-zinc-700 bg-zinc-900/80 p-2"
    : "rounded-lg border border-zinc-200/90 bg-zinc-50/90 p-2 dark:border-zinc-700/90 dark:bg-zinc-900/60";
  const dismissBtn = onDark
    ? "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
    : "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-200/80 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200";
  const settingsLink = onDark ? "font-medium text-amber-400 underline" : "font-medium text-amber-800 underline dark:text-amber-400";
  const allLink = onDark
    ? "mt-3 shrink-0 px-1 text-[11px] font-medium text-amber-400 underline-offset-2 hover:underline"
    : "mt-3 shrink-0 px-1 text-[11px] font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-400";

  if (!authChecked) {
    return (
      <div className="flex shrink-0 flex-col gap-2 px-1">
        <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="px-1">
        <p className={`text-[11px] leading-relaxed ${muted}`}>Sign in to see likes, comments, follows, and shares.</p>
      </div>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-labelledby={headingId}>
      <div className="flex shrink-0 items-center gap-2 px-1">
        <Bell className={`h-4 w-4 shrink-0 ${headingIcon}`} aria-hidden />
        <h2 id={headingId} className={`text-[11px] font-semibold uppercase tracking-wide ${muted}`}>
          Community activity
        </h2>
      </div>

      {!enabled ? (
        <p className={`mt-2 shrink-0 px-1 text-[11px] leading-relaxed ${muted}`}>
          Notifications are off in{" "}
          <Link href="/settings" className={settingsLink}>
            Settings
          </Link>
          .
        </p>
      ) : loading ? (
        <div className={`mt-3 flex shrink-0 items-center gap-2 px-1 text-[11px] ${muted}`}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : items.length === 0 ? (
        <p className={`mt-3 shrink-0 px-1 text-[11px] leading-relaxed ${muted}`}>No notifications yet.</p>
      ) : (
        <ul className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
          {items.map((n) => {
            const postId = n.meta && typeof n.meta.postId === "string" ? n.meta.postId : n.meta?.postId ? String(n.meta.postId) : "";
            const actorCommunityUsername =
              n.type === "community_follow" && n.meta && typeof n.meta.actorCommunityUsername === "string"
                ? n.meta.actorCommunityUsername
                : "";
            const profileHref = actorCommunityUsername
              ? `/community/user/${encodeURIComponent(actorCommunityUsername)}`
              : "";
            const linkHref = postId ? `/community/post/${encodeURIComponent(postId)}` : profileHref || "";
            const created = n.createdAt ? new Date(n.createdAt) : null;
            const body = (
              <>
                <p className={titleCls}>{n.title}</p>
                <p className={msgCls}>{n.message}</p>
                {created && !Number.isNaN(created.getTime()) ? (
                  <p className={timeCls}>{formatDistanceToNow(created, { addSuffix: true })}</p>
                ) : null}
              </>
            );

            return (
              <li key={String(n._id)} className={cardCls}>
                <div className="flex gap-1">
                  <div className="min-w-0 flex-1">
                    {linkHref ? (
                      <Link href={linkHref} className="block rounded-md outline-offset-2 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-amber-500/80">
                        {body}
                      </Link>
                    ) : (
                      <div>{body}</div>
                    )}
                  </div>
                  <button type="button" onClick={(e) => void dismiss(n._id, e)} className={dismissBtn} aria-label="Dismiss notification">
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/notifications" className={allLink}>
        All notifications
      </Link>
    </section>
  );
}
