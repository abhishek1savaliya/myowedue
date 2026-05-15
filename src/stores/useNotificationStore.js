"use client";

import { create } from "zustand";
import { io } from "socket.io-client";

export const useNotificationStore = create((set, get) => ({
  count: 0,
  _socket: null,
  _userId: null,

  setCount(count) {
    set({ count: Math.max(0, Number(count) || 0) });
  },

  async fetchCount() {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        set({ count: Number(data.notificationCount || 0) });
      }
    } catch {
      // Keep existing count on failure.
    }
  },

  connect(userId) {
    const id = String(userId || "");
    if (!id) return;

    const { _socket, _userId } = get();
    if (_socket && _userId === id) return;

    get().disconnect();

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4001";
    const socket = io(socketUrl, { transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      socket.emit("join", { userId: id });
    });

    socket.on("notification:update", () => {
      void get().fetchCount();
    });

    set({ _socket: socket, _userId: id });
    void get().fetchCount();
  },

  disconnect() {
    const { _socket } = get();
    if (_socket) _socket.disconnect();
    set({ _socket: null, _userId: null });
  },
}));
