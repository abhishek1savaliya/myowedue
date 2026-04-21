export default function Loader({ label = null, className = "" }) {
  return (
    <div
      className={`premium-spinner-wrap flex items-center justify-center gap-2 py-4 text-xs text-zinc-600 sm:gap-3 sm:py-6 sm:text-sm ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span className="premium-spinner-core h-6 w-6 animate-spin text-amber-400 [animation-duration:700ms] sm:h-8 sm:w-8" aria-hidden="true">
        <svg
          className="h-full w-full"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-15" />
          <path
            d="M12 3a9 9 0 0 1 9 9"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="opacity-100"
          />
        </svg>
      </span>
      {label ? <span className="premium-spinner-label">{label}</span> : null}
    </div>
  );
}
