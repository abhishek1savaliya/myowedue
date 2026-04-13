export default function StatCard({ title, value, subtitle, className = "", titleClassName = "", valueClassName = "", subtitleClassName = "" }) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ${className}`}>
      <p className={`text-xs uppercase tracking-[0.2em] text-zinc-500 ${titleClassName}`}>{title}</p>
      <h3 className={`mt-3 text-3xl font-semibold text-black ${valueClassName}`}>{value}</h3>
      {subtitle ? <p className={`mt-2 text-sm text-zinc-600 ${subtitleClassName}`}>{subtitle}</p> : null}
    </div>
  );
}
