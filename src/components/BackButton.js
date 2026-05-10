import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const base =
  "inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-800";

/**
 * Pill “Back” control (arrow + label) for consistent navigation across the app.
 * @param {{ href: string; label?: string; className?: string }} props
 */
export default function BackButton({ href, label = "Back", className = "" }) {
  return (
    <Link href={href} className={`${base} ${className}`.trim()}>
      <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      {label}
    </Link>
  );
}
