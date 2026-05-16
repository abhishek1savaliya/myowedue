import { cn } from "@/lib/utils";

/** Lightweight card surface — CSS only (no scroll-blocking blur or motion). */
export default function SpotlightCard({ className, children }) {
  return (
    <div
      className={cn(
        "landing-card group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.35)] transition-[border-color,box-shadow] duration-200 hover:border-white/[0.14] hover:shadow-[0_12px_48px_rgba(0,0,0,0.45)]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(520px circle at 50% 0%, rgba(245, 158, 11, 0.1), transparent 55%)",
        }}
        aria-hidden
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
