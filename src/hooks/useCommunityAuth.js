"use client";

import { useLayoutEffect, useState } from "react";
import { useUserStore } from "@/stores/useUserStore";

/**
 * Resolves community auth before rendering auth-dependent UI.
 * @param {object | null} initialUser — from server layout (null = guest)
 */
export function useCommunityAuth(initialUser) {
  const user = useUserStore((s) => s.user);
  const [authChecked, setAuthChecked] = useState(false);

  useLayoutEffect(() => {
    let cancelled = false;

    (async () => {
      if (initialUser) {
        useUserStore.getState().setUser(initialUser);
      } else {
        useUserStore.getState().clearUser();
      }

      try {
        await useUserStore.getState().fetchUser({ force: true });
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialUser]);

  return {
    authChecked,
    /** Avoid stale persist showing logged-in chrome before server + /api/auth/me confirm. */
    loggedIn: authChecked && Boolean(user),
    user: authChecked ? user : null,
  };
}
