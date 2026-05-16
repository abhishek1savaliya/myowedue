"use client";

import { useEffect } from "react";
import { useCommunityTrendingStore } from "@/stores/useCommunityTrendingStore";
import { useUserStore } from "@/stores/useUserStore";

/** Single trending fetch + mutate listener for all community rails. */
export default function CommunityStoreBootstrap() {
  useEffect(() => {
    useCommunityTrendingStore.getState().bootstrap();
    void useUserStore.getState().fetchUser();
  }, []);

  return null;
}
