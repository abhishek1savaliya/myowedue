import { refreshAppCache } from "@/lib/refresh-app-cache";

/** Map API paths to cache invalidation groups after a successful sync. */
export function invalidateCachesForUrl(url) {
  const path = String(url || "").split("?")[0];

  if (path.includes("/api/person")) {
    refreshAppCache(["people", "transactions", "dashboard", "bin"]);
    return;
  }
  if (path.includes("/api/transaction")) {
    refreshAppCache(["transactions", "people", "dashboard", "bin"]);
    return;
  }
  if (path.includes("/api/events")) {
    refreshAppCache(["events", "dashboard", "bin"]);
    return;
  }
  if (path.includes("/api/cards")) {
    refreshAppCache(["cards", "dashboard"]);
    return;
  }
  if (path.includes("/api/folders") || path.includes("/api/files")) {
    refreshAppCache(["files", "dashboard"]);
    return;
  }
  if (path.includes("/api/subscription")) {
    refreshAppCache(["subscription", "user", "dashboard"]);
    return;
  }
  if (path.includes("/api/community")) {
    refreshAppCache(["community", "notifications"]);
    return;
  }
  if (path.includes("/api/auth/me") || path.includes("/api/user")) {
    refreshAppCache(["user"]);
  }
}
