/** Central cache keys + invalidation groups for Zustand API cache. */

export const CACHE_KEYS = {
  user: "auth:me",
  exchangeRates: "exchange-rates",
  people: "person:list",
  person: (id) => `person:${id}`,
  transactions: (query) => `transactions:${stableQuery(query)}`,
  events: "events:list",
  cards: "cards:list",
  notifications: "notifications:list",
  notificationsCommunity: "notifications:community",
  binPerson: "bin:person",
  binTransaction: "bin:transaction",
  binEvent: "bin:event",
  dashboard: (currency) => `dashboard:${currency || "AUD"}`,
  reportsSnapshot: (currency = "AUD") => `reports:${currency}`,
  subscriptionStatus: "subscription:status",
  subscriptionHistory: "subscription:history",
  folders: "folders:list",
  filesList: (limit = 50) => `files:list:${limit}`,
  filesMore: (cursor) => `files:more:${cursor}`,
  suggestedCreators: "community:suggested-creators",
  communityPosts: (query) => `community:posts:${stableQuery(query)}`,
  contentEditor: (page) => `content:editor:${page}`,
  contentPermissions: "content:permissions",
  contentAudit: "content:audit",
};

function stableQuery(query) {
  if (!query || typeof query !== "object") return "";
  return Object.keys(query)
    .sort()
    .map((k) => `${k}=${query[k] ?? ""}`)
    .join("&");
}

export function invalidateAppData(store, groups = []) {
  const all = groups.length === 0;
  const hit = (group) => all || groups.includes(group);

  if (hit("people")) {
    store.invalidate(CACHE_KEYS.people);
    store.invalidate(CACHE_KEYS.binPerson);
  }
  if (hit("transactions")) {
    store.invalidatePrefix("transactions:");
    store.invalidate(CACHE_KEYS.binTransaction);
  }
  if (hit("events")) {
    store.invalidate(CACHE_KEYS.events);
    store.invalidate(CACHE_KEYS.binEvent);
  }
  if (hit("cards")) store.invalidate(CACHE_KEYS.cards);
  if (hit("files")) {
    store.invalidate(CACHE_KEYS.folders);
    store.invalidatePrefix("files:");
  }
  if (hit("dashboard")) {
    store.invalidatePrefix("dashboard:");
    store.invalidatePrefix("reports:");
  }
  if (hit("notifications")) store.invalidate(CACHE_KEYS.notifications);
  if (hit("subscription")) {
    store.invalidate(CACHE_KEYS.subscriptionStatus);
    store.invalidate(CACHE_KEYS.subscriptionHistory);
  }
  if (hit("bin")) {
    store.invalidate(CACHE_KEYS.binPerson);
    store.invalidate(CACHE_KEYS.binTransaction);
    store.invalidate(CACHE_KEYS.binEvent);
  }
  if (hit("content")) {
    store.invalidatePrefix("content:");
  }
  if (hit("user")) store.invalidate(CACHE_KEYS.user);
}
