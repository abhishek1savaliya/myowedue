"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_CACHE_STALE_MS } from "@/lib/cache-stale";
import { useApiCacheStore } from "@/stores/useApiCacheStore";

/**
 * Cached GET with sessionStorage persistence (survives refresh).
 * Skips network + revalidate UI when cache is still fresh.
 * @param {string} cacheKey
 * @param {string} url
 * @param {{ staleMs?: number; enabled?: boolean; deps?: unknown[] }} [options]
 */
export function useCachedFetch(cacheKey, url, options = {}) {
  const { staleMs = DEFAULT_CACHE_STALE_MS, enabled = true, deps = [] } = options;
  const fetchCached = useApiCacheStore((s) => s.fetch);
  const getCached = useApiCacheStore((s) => s.getCached);
  const getEntry = useApiCacheStore((s) => s.getEntry);

  const [data, setData] = useState(() => (enabled ? getCached(cacheKey) : null));
  const [loading, setLoading] = useState(() => enabled && getCached(cacheKey) == null);
  const [error, setError] = useState("");
  const [fromCache, setFromCache] = useState(() => getCached(cacheKey) != null);
  const [revalidating, setRevalidating] = useState(false);
  const hasLoadedRef = useRef(getCached(cacheKey) != null);

  const load = useCallback(
    async ({ force = false } = {}) => {
      if (!enabled || !cacheKey || !url) return;

      const entry = getEntry(cacheKey);
      const cachedData = entry?.data;
      const isFresh = entry && Date.now() - entry.fetchedAt < staleMs;

      if (!force && isFresh && cachedData != null) {
        setData(cachedData);
        setFromCache(true);
        hasLoadedRef.current = true;
        setLoading(false);
        setRevalidating(false);
        return;
      }

      const soft = hasLoadedRef.current || cachedData != null;
      if (!soft) setLoading(true);
      else setRevalidating(true);
      setError("");

      try {
        const result = await fetchCached(cacheKey, url, { force, staleMs });
        if (result.ok) {
          setData(result.data);
          setFromCache(result.fromCache);
          hasLoadedRef.current = true;
        } else {
          const message = result.data?.message || "Request failed";
          if (!soft) {
            setData(null);
            setError(message);
          } else {
            setError(message);
          }
        }
      } catch (err) {
        const message = err?.message === "Failed to fetch" ? "Network error" : err?.message || "Request failed";
        if (!soft) {
          setData(null);
          setError(message);
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
        setRevalidating(false);
      }
    },
    [cacheKey, url, enabled, staleMs, fetchCached, getEntry]
  );

  useEffect(() => {
    if (!enabled) return;

    const entry = getEntry(cacheKey);
    const cached = entry?.data;
    if (cached != null) {
      setData(cached);
      setFromCache(true);
      hasLoadedRef.current = true;
      setLoading(false);
    }

    const isFresh = entry && Date.now() - entry.fetchedAt < staleMs;
    if (!isFresh || cached == null) {
      void load({ force: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, url, enabled, staleMs, load, ...deps]);

  return {
    data,
    loading,
    error,
    fromCache,
    revalidating,
    refresh: () => load({ force: true }),
    revalidate: () => load({ force: false }),
  };
}
