"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApiCacheStore } from "@/stores/useApiCacheStore";

/**
 * Parallel cached GETs (sessionStorage-backed).
 * @param {Array<{ key: string; url: string }>} specs
 * @param {{ deps?: unknown[]; enabled?: boolean; staleMs?: number }} [options]
 */
export function useCachedParallel(specs, options = {}) {
  const { deps = [], enabled = true, staleMs } = options;
  const fetchCached = useApiCacheStore((s) => s.fetch);
  const getCached = useApiCacheStore((s) => s.getCached);

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

  const load = useCallback(
    async ({ force = false } = {}) => {
      if (!enabled || !specs.length) return;

      const soft = hasLoadedRef.current;
      if (!soft) setLoading(true);
      else setRevalidating(true);

      const nextErrors = {};
      const nextData = { ...data };

      await Promise.all(
        specs.map(async ({ key, url }) => {
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

      setData(nextData);
      setErrors(nextErrors);
      hasLoadedRef.current = true;
      setLoading(false);
      setRevalidating(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [specsKey, enabled, staleMs, fetchCached]
  );

  useEffect(() => {
    if (!enabled) return;
    const hydrated = {};
    let hasAny = false;
    specs.forEach(({ key }) => {
      const cached = getCached(key);
      if (cached != null) {
        hydrated[key] = cached;
        hasAny = true;
      }
    });
    if (hasAny) {
      setData((prev) => ({ ...prev, ...hydrated }));
      hasLoadedRef.current = specs.every(({ key }) => getCached(key) != null);
      setLoading(false);
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specsKey, enabled, ...deps]);

  return {
    data,
    loading,
    revalidating,
    errors,
    refresh: () => load({ force: true }),
    revalidate: () => load({ force: false }),
  };
}
