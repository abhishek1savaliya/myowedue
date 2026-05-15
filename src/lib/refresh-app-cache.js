import { useApiCacheStore } from "@/stores/useApiCacheStore";
import { invalidateAppData } from "@/lib/cache-keys";

export function refreshAppCache(groups) {
  invalidateAppData(useApiCacheStore.getState(), groups);
}
