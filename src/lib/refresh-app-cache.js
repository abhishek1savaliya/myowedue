import { useApiCacheStore } from "@/stores/useApiCacheStore";
import { useUserStore } from "@/stores/useUserStore";
import { invalidateAppData } from "@/lib/cache-keys";
import { isOnline } from "@/lib/offline/network";

export function refreshAppCache(groups) {
  if (!isOnline()) {
    return;
  }
  invalidateAppData(useApiCacheStore.getState(), groups);
  if (groups.length === 0 || groups.includes("user")) {
    useUserStore.getState().invalidate();
  }
}
