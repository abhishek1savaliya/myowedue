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
            <article key={item._id} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-black">{item.title}</h2>
                  <p className="mt-1 text-sm text-zinc-600">{item.message}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                    {String(item.type || "insight").replaceAll("_", " ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteNotification(item._id)}
                    aria-label="Delete notification"
                    className="rounded-full border border-zinc-300 p-1 text-zinc-500 transition hover:border-black hover:text-black"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                {new Date(item.createdAt).toLocaleString()} • Expires {new Date(item.expiresAt).toLocaleDateString()}
              </p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
