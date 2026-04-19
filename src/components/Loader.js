export default function Loader({ label = null, className = "" }) {
  return (
    <div
      className={`flex items-center justify-center gap-3 py-6 text-sm text-zinc-600 ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span className="relative inline-flex h-8 w-8" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border-4 border-sky-100" />
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-sky-600 border-r-sky-600" />
      </span>
      {label ? <span>{label}</span> : null}
    </div>
  );
}
