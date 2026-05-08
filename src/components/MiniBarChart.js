"use client";

import { useEffect, useState } from "react";

function useAnimatedNumber(target, duration = 800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const end = Number(target || 0);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setValue(end);
      return undefined;
    }

    let frameId;
    const start = value;
    const delta = end - start;
    const startedAt = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(start + delta * eased);
      if (progress < 1) frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [target, duration]);

  return value;
}

function AnimatedAmount({ value }) {
  const animated = useAnimatedNumber(value);
  return <>{animated.toFixed(0)}</>;
}

export default function MiniBarChart({ title, data = [], xKey, aKey, bKey }) {
  const [isVisible, setIsVisible] = useState(false);
  const max = Math.max(
    1,
    ...data.map((d) => Math.max(Number(d[aKey] || 0), Number(d[bKey] || 0)))
  );

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setIsVisible(true);
      return undefined;
    }

    setIsVisible(false);
    const frameId = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frameId);
  }, [data]);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 transition duration-500 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_45px_rgba(0,0,0,0.08)]">
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-700">{title}</h3>
      <div className="mt-4 space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-zinc-500">No data yet.</p>
        ) : (
          data.slice(0, 8).map((item, idx) => {
            const a = Number(item[aKey] || 0);
            const b = Number(item[bKey] || 0);
            return (
              <div key={`${item[xKey]}-${idx}`}>
                <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                  <span>{item[xKey]}</span>
                  <span>
                    <AnimatedAmount value={a} /> / <AnimatedAmount value={b} />
                  </span>
                </div>
                <div className="flex h-2 gap-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="bg-black transition-[width] duration-700 ease-out"
                    style={{ width: isVisible ? `${(a / max) * 100}%` : "0%" }}
                  />
                  <div
                    className="bg-zinc-400 transition-[width] duration-700 ease-out"
                    style={{ width: isVisible ? `${(b / max) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
