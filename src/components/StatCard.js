"use client";

import { useEffect, useState } from "react";

function useAnimatedNumber(target, duration = 900) {
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

export default function StatCard({
  title,
  value,
  numericValue,
  formatValue,
  subtitle,
  className = "",
  titleClassName = "",
  valueClassName = "",
  subtitleClassName = "",
}) {
  const hasAnimatedValue = typeof numericValue === "number";
  const animatedValue = useAnimatedNumber(hasAnimatedValue ? numericValue : 0);
  const displayValue = hasAnimatedValue && typeof formatValue === "function" ? formatValue(animatedValue) : value;

  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition duration-500 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_45px_rgba(0,0,0,0.08)] ${className}`}>
      <p className={`text-xs uppercase tracking-[0.2em] text-zinc-500 ${titleClassName}`}>{title}</p>
      <h3 className={`mt-3 text-3xl font-semibold text-black transition-colors duration-500 ${valueClassName}`}>{displayValue}</h3>
      {subtitle ? <p className={`mt-2 text-sm text-zinc-600 ${subtitleClassName}`}>{subtitle}</p> : null}
    </div>
  );
}
