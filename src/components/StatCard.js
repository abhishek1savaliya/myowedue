"use client";

import { useEffect, useState } from "react";
import { uiCard } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

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
    <div className={cn(uiCard, "hover:-translate-y-0.5", className)}>
      <p className={cn("text-xs uppercase tracking-[0.2em] text-zinc-500", titleClassName)}>{title}</p>
      <h3 className={cn("mt-3 text-3xl font-semibold tabular-nums text-foreground transition-colors duration-500", valueClassName)}>
        {displayValue}
      </h3>
      {subtitle ? <p className={cn("mt-2 text-sm text-zinc-400", subtitleClassName)}>{subtitle}</p> : null}
    </div>
  );
}
