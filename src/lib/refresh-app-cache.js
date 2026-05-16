import { useApiCacheStore } from "@/stores/useApiCacheStore";
import { useUserStore } from "@/stores/useUserStore";
import { invalidateAppData } from "@/lib/cache-keys";

export function refreshAppCache(groups) {
  invalidateAppData(useApiCacheStore.getState(), groups);
  if (groups.length === 0 || groups.includes("user")) {
    useUserStore.getState().invalidate();
  }
}
