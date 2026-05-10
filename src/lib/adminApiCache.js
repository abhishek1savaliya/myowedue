const cacheStore = new Map();

/**
 * Tiny in-memory cache for hot admin API reads.
 * Scope: current server process only.
 */
export async function getCachedOrCompute(key, ttlMs, compute) {
  const now = Date.now();
  const current = cacheStore.get(key);

  if (current && current.expiresAt > now && current.value !== undefined) {
    return current.value;
  }

  if (current?.inFlight) {
    return current.inFlight;
  }

  const inFlight = (async () => {
    try {
      const value = await compute();
      cacheStore.set(key, {
        value,
        expiresAt: Date.now() + Math.max(0, Number(ttlMs) || 0),
        inFlight: null,
      });
      return value;
    } catch (err) {
      const existing = cacheStore.get(key);
      if (existing?.inFlight) {
        cacheStore.delete(key);
      }
      throw err;
    }
  })();

  cacheStore.set(key, {
    value: current?.value,
    expiresAt: current?.expiresAt || 0,
    inFlight,
  });

  return inFlight;
}
