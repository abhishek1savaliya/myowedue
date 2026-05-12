"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { io } from "socket.io-client";
import Loader from "@/components/Loader";
import EmptyState from "@/components/EmptyState";

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [enabled, setEnabled] = useState(true);

  async function loadNotifications() {
    setLoading(true);
    const res = await fetch("/api/notifications", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setEnabled(data.notificationsEnabled !== false);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let socket = null;

    async function setupSocket() {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const meData = await meRes.json().catch(() => ({}));
      const userId = meData?.user?.id;
      if (!userId || isCancelled) return;

      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4001";
      socket = io(socketUrl, { transports: ["websocket", "polling"] });

      socket.on("connect", () => {
        socket.emit("join", { userId });
      });

      socket.on("notification:update", () => {
        loadNotifications();
      });
    }

    setupSocket();

    return () => {
      isCancelled = true;
      if (socket) socket.disconnect();
    };
  }, []);

  async function deleteNotification(id) {
    const previous = notifications;
    setNotifications((items) => items.filter((item) => item._id !== id));

    const res = await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setNotifications(previous);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700">
          <Bell size={14} /> {notifications.length}
        </span>
      </header>

      {!enabled ? (
        <EmptyState text="Notifications are turned off in Profile settings." />
      ) : loading ? (
        <Loader />
      ) : notifications.length === 0 ? (
        <EmptyState text="No notifications right now." />
      ) : (
        <section className="space-y-3">
          {notifications.map((item) => (
            <article key={item._id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/80">
              <div className="flex items-start justify-between gap-2">
                <h2 className="min-w-0 text-sm font-semibold text-black dark:text-zinc-50">{item.title}</h2>
                <button
                  type="button"
                  onClick={() => deleteNotification(item._id)}
                  aria-label="Delete notification"
                  className="shrink-0 rounded-full border border-zinc-300 p-1 text-zinc-500 transition hover:border-black hover:text-black dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-300 dark:hover:text-zinc-100"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-400">
                  {String(item.type || "insight").replaceAll("_", " ")}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  Expires {new Date(item.expiresAt).toLocaleDateString()}
                </span>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
