export default function Loader({ label = null, className = "" }) {
  return (
    <div
      className={`flex items-center justify-center gap-2 py-4 text-xs text-zinc-600 sm:gap-3 sm:py-6 sm:text-sm ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span className="relative inline-flex h-6 w-6 sm:h-8 sm:w-8" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border-[3px] border-sky-100 sm:border-4" />
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-sky-600 border-r-sky-600 sm:border-4" />
      </span>
      {label ? <span>{label}</span> : null}
    </div>
  );
}
