export default function AuthLayout({ children }) {
  return (
    <main className="relative flex min-h-dvh flex-col justify-center overflow-x-hidden bg-stone-100 px-4 py-10 sm:px-6 sm:py-12 md:px-8 dark:bg-slate-950">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.22),transparent),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(16,185,129,0.12),transparent),radial-gradient(ellipse_50%_50%_at_0%_100%,rgba(251,191,36,0.08),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,191,36,0.12),transparent),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(16,185,129,0.08),transparent)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-amber-400/25 blur-3xl dark:bg-amber-500/15" aria-hidden />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/10" aria-hidden />

      <div className="relative z-1 mx-auto w-full max-w-[min(100%,28rem)]">{children}</div>
    </main>
  );
}
