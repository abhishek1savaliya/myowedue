"use client";

import { useEffect, useRef, useState } from "react";

function parseStatValue(raw) {
  const text = String(raw || "0");
  const match = text.match(/^([^0-9]*)([0-9,.]+)(.*)$/);
  if (!match) return { prefix: "", value: 0, suffix: text, decimals: 0 };
  const num = Number(match[2].replace(/,/g, ""));
  const decimals = (match[2].split(".")[1] || "").length;
  return { prefix: match[1], value: Number.isFinite(num) ? num : 0, suffix: match[3], decimals };
}

export default function AnimatedCounter({ value, className }) {
  const ref = useRef(null);
  const { prefix, value: target, suffix, decimals } = parseStatValue(value);
  const [display, setDisplay] = useState(target);
  const animatedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || animatedRef.current) return undefined;

    if (typeof IntersectionObserver === "undefined") return undefined;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || animatedRef.current) return;
        animatedRef.current = true;
        obs.disconnect();

        const duration = 900;
        const start = performance.now();
        let frame = 0;

        function tick(now) {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - (1 - t) ** 3;
          setDisplay(target * eased);
          if (t < 1) frame = requestAnimationFrame(tick);
        }

        frame = requestAnimationFrame(tick);
      },
      { rootMargin: "-40px", threshold: 0.2 }
    );

    obs.observe(el);
    return () => {
      obs.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [target]);

  const formatted =
    decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString("en-US");

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
