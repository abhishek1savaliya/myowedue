"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_CACHE_STALE_MS } from "@/lib/cache-stale";
import { useApiCacheStore } from "@/stores/useApiCacheStore";

/**
 * Parallel cached GETs (sessionStorage-backed).
 * Skips network when all keys are still fresh.
 * @param {Array<{ key: string; url: string }>} specs
 * @param {{ deps?: unknown[]; enabled?: boolean; staleMs?: number }} [options]
 */
export function useCachedParallel(specs, options = {}) {
  const { deps = [], enabled = true, staleMs = DEFAULT_CACHE_STALE_MS } = options;
  const fetchCached = useApiCacheStore((s) => s.fetch);
  const getCached = useApiCacheStore((s) => s.getCached);
  const getEntry = useApiCacheStore((s) => s.getEntry);

  const specsRef = useRef(specs);
  specsRef.current = specs;

  const specsKey = specs.map((s) => `${s.key}:${s.url}`).join("|");

  const [data, setData] = useState(() => {
    if (!enabled) return {};
    const initial = {};
    specs.forEach(({ key }) => {
      const cached = getCached(key);
      if (cached !== null && cached !== undefined) initial[key] = cached;
    });
    return initial;
  });
  const [loading, setLoading] = useState(() => {
    if (!enabled) return false;
    return specs.some(({ key }) => getCached(key) == null);
  });
  const [revalidating, setRevalidating] = useState(false);
  const [errors, setErrors] = useState({});
  const hasLoadedRef = useRef(
    enabled && specs.length > 0 && specs.every(({ key }) => getCached(key) != null)
  );

  const checkAllFresh = useCallback(() => {
    const current = specsRef.current;
    if (!current.length) return true;
    return current.every(({ key }) => {
      const entry = getEntry(key);
      return entry?.data != null && Date.now() - entry.fetchedAt < staleMs;
    });
  }, [getEntry, staleMs]);

  const load = useCallback(
    async ({ force = false } = {}) => {
      const currentSpecs = specsRef.current;
      if (!enabled || !currentSpecs.length) return;

      if (!force && checkAllFresh()) {
        const snapshot = {};
        currentSpecs.forEach(({ key }) => {
          const entry = getEntry(key);
          if (entry?.data != null) snapshot[key] = entry.data;
        });
        setData(snapshot);
        hasLoadedRef.current = true;
        setLoading(false);
        setRevalidating(false);
        return;
      }

      const soft = hasLoadedRef.current;
      if (!soft) setLoading(true);
      else setRevalidating(true);

      const nextErrors = {};
      const nextData = {};

      await Promise.all(
        currentSpecs.map(async ({ key, url }) => {
          try {
            const result = await fetchCached(key, url, { force, staleMs });
            if (result.ok) {
              nextData[key] = result.data;
            } else {
              nextErrors[key] = result.data?.message || "Request failed";
            }
          } catch (err) {
            nextErrors[key] = err?.message || "Request failed";
          }
        })
      );

      setData((prev) => ({ ...prev, ...nextData }));
      setErrors(nextErrors);
      hasLoadedRef.current = true;
      setLoading(false);
      setRevalidating(false);
    },
    [enabled, staleMs, fetchCached, getEntry, checkAllFresh]
  );

  useEffect(() => {
    if (!enabled) return;

    const currentSpecs = specsRef.current;
    const hydrated = {};
    let hasAny = false;
    currentSpecs.forEach(({ key }) => {
      const cached = getCached(key);
      if (cached != null) {
        hydrated[key] = cached;
        hasAny = true;
      }
    });
    if (hasAny) {
      setData((prev) => ({ ...prev, ...hydrated }));
      hasLoadedRef.current = currentSpecs.every(({ key }) => getCached(key) != null);
      setLoading(false);
    }

    if (!checkAllFresh()) {
      void load({ force: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specsKey, enabled, staleMs, load, checkAllFresh, ...deps]);

  return {
    data,
    loading,
    revalidating,
    errors,
    refresh: () => load({ force: true }),
    revalidate: () => load({ force: false }),
  };
}
