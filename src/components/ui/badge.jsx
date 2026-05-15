import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default: "border-amber-500/30 bg-amber-500/10 text-amber-200",
        secondary: "border-white/10 bg-white/5 text-zinc-300",
        emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
        outline: "border-white/15 text-zinc-300",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
