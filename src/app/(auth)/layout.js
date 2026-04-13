export default function AuthLayout({ children }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-stone-100 px-4 py-10">
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-amber-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-4 h-64 w-64 rounded-full bg-emerald-300/30 blur-3xl" />
      <div className="mx-auto max-w-md">{children}</div>
    </main>
  );
}
