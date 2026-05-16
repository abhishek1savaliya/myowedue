import { useApiCacheStore } from "@/stores/useApiCacheStore";

/** Run after zustand persist has read sessionStorage (SSR-safe). */
export function whenApiCacheHydrated(callback) {
  const persist = useApiCacheStore.persist;
  if (persist?.hasHydrated?.()) {
    callback();
    return () => {};
  }
  return persist?.onFinishHydration?.(callback) ?? (() => {});
}
