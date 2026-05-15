"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApiCacheStore } from "@/stores/useApiCacheStore";

/**
 * Cached GET with sessionStorage persistence (survives refresh).
 * @param {string} cacheKey
 * @param {string} url
 * @param {{ staleMs?: number; enabled?: boolean; deps?: unknown[] }} [options]
 */
export function useCachedFetch(cacheKey, url, options = {}) {
  const { staleMs, enabled = true, deps = [] } = options;
  const fetchCached = useApiCacheStore((s) => s.fetch);
  const getCached = useApiCacheStore((s) => s.getCached);

  const [data, setData] = useState(() => (enabled ? getCached(cacheKey) : null));
  const [loading, setLoading] = useState(enabled && !getCached(cacheKey));
  const [error, setError] = useState("");
  const [fromCache, setFromCache] = useState(Boolean(getCached(cacheKey)));
  const [revalidating, setRevalidating] = useState(false);
  const hasLoadedRef = useRef(Boolean(getCached(cacheKey)));

  const load = useCallback(
    async ({ force = false } = {}) => {
      if (!enabled || !cacheKey || !url) return;

      const soft = hasLoadedRef.current;
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
    [cacheKey, url, enabled, staleMs, fetchCached]
  );

  useEffect(() => {
    if (!enabled) return;
    const cached = getCached(cacheKey);
    if (cached) {
      setData(cached);
      setFromCache(true);
      hasLoadedRef.current = true;
      setLoading(false);
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, url, enabled, ...deps]);

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
