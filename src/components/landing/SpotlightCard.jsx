import { cn } from "@/lib/utils";

/** Lightweight card surface — theme-aware via `.landing-card` in globals.css */
export default function SpotlightCard({ className, children }) {
  return (
    <div className={cn("landing-card group relative overflow-hidden rounded-2xl border p-6 transition-shadow duration-200", className)}>
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 landing-card-glow" aria-hidden />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
