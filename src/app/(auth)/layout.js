export default function AuthLayout({ children }) {
  return (
    <main className="relative flex min-h-dvh flex-col justify-center overflow-x-hidden bg-linear-to-b from-background via-background to-background px-4 py-10 text-foreground sm:px-6 sm:py-12 md:px-8">
      <div
        className="frontpage-aurora pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(245,158,11,0.14),transparent_34%),radial-gradient(circle_at_84%_84%,rgba(16,185,129,0.12),transparent_34%)]"
        aria-hidden
      />

      <div className="relative z-1 mx-auto w-full max-w-[min(100%,28rem)]">{children}</div>
    </main>
  );
}
