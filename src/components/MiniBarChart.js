export default function MiniBarChart({ title, data = [], xKey, aKey, bKey }) {
  const max = Math.max(
    1,
    ...data.map((d) => Math.max(Number(d[aKey] || 0), Number(d[bKey] || 0)))
  );

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-700">{title}</h3>
      <div className="mt-4 space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-zinc-500">No data yet.</p>
        ) : (
          data.slice(0, 8).map((item, idx) => {
            const a = Number(item[aKey] || 0);
            const b = Number(item[bKey] || 0);
            return (
              <div key={`${item[xKey]}-${idx}`}>
                <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                  <span>{item[xKey]}</span>
                  <span>
                    {a.toFixed(0)} / {b.toFixed(0)}
                  </span>
                </div>
                <div className="flex h-2 gap-1 overflow-hidden rounded-full bg-zinc-100">
                  <div className="bg-black" style={{ width: `${(a / max) * 100}%` }} />
                  <div className="bg-zinc-400" style={{ width: `${(b / max) * 100}%` }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
