export default function ProgressBar({
  value = 0,
  label = "Progress",
  size = "md",
  minVisibleValue = 0,
  fillClassName = "bg-black",
  trackClassName = "bg-zinc-200",
  className = "",
}) {
  const normalizedValue = Math.min(100, Math.max(0, Number(value || 0)));
  const displayValue = normalizedValue > 0 && normalizedValue < minVisibleValue ? minVisibleValue : normalizedValue;
  const heightClassName = size === "sm" ? "h-2" : "h-3";

  return (
    <div
      className={`${heightClassName} overflow-hidden rounded-full ${trackClassName} ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(normalizedValue)}
    >
      <div className={`h-full rounded-full transition-all duration-300 ${fillClassName}`} style={{ width: `${displayValue}%` }} />
    </div>
  );
}
