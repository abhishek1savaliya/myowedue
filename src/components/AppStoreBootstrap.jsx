"use client";

import { useEffect } from "react";
import { useUserStore } from "@/stores/useUserStore";
import { useNotificationStore } from "@/stores/useNotificationStore";

/** One auth fetch + notification socket for the whole app (avoids per-route refetches). */
export default function AppStoreBootstrap() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const user = await useUserStore.getState().fetchUser();
      if (cancelled) return;
      if (user?.id) {
        useNotificationStore.getState().connect(user.id);
      }
    })();

    return () => {
      cancelled = true;
      useNotificationStore.getState().disconnect();
    };
  }, []);

  return null;
}
