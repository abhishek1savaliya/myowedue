"use client";

import { useEffect } from "react";
import { useCommunityTrendingStore } from "@/stores/useCommunityTrendingStore";

/** Single trending fetch + mutate listener for all community rails. */
export default function CommunityStoreBootstrap() {
  useEffect(() => {
    useCommunityTrendingStore.getState().bootstrap();
  }, []);

  return null;
}
