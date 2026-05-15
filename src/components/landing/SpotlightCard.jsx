"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function SpotlightCard({ className, children, delay = 0 }) {
  const ref = useRef(null);
  const [spot, setSpot] = useState({ x: 50, y: 50, opacity: 0 });

  function onMove(e) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSpot({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
      opacity: 1,
    });
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={onMove}
      onMouseLeave={() => setSpot((s) => ({ ...s, opacity: 0 }))}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-[border-color,box-shadow] duration-300 hover:border-white/[0.14] hover:shadow-[0_12px_50px_rgba(0,0,0,0.5)]",
        className
      )}
      style={{
        backgroundImage: `radial-gradient(600px circle at ${spot.x}% ${spot.y}%, rgba(245,158,11,0.12), transparent 40%)`,
      }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ opacity: spot.opacity * 0.9 }}
        aria-hidden
      >
        <motion.div
          className="absolute -inset-px rounded-2xl"
          style={{
            background: `radial-gradient(400px circle at ${spot.x}% ${spot.y}%, rgba(245,158,11,0.15), transparent 45%)`,
          }}
        />
      </motion.div>
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
