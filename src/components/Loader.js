export default function Loader({ label = null, className = "" }) {
  return (
    <div className={`flex items-center gap-2 text-sm text-zinc-600 ${className}`.trim()} role="status" aria-live="polite">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </div>
  );
}
