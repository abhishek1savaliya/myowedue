import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="relative border-t border-stone-700/70 bg-stone-950/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-stone-300 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">MYOWEDUE</p>
          <p className="mt-1 text-xs text-stone-400">Premium personal credit and debit management.</p>
        </div>
        <nav className="flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-[0.12em]">
          <Link href="/signup" className="transition hover:text-amber-200">Sign up</Link>
          <Link href="/login" className="transition hover:text-amber-200">Login</Link>
          <Link href="/privacy-policy" className="transition hover:text-amber-200">Privacy policy</Link>
          <Link href="/contact-us" className="transition hover:text-amber-200">Contact us</Link>
        </nav>
      </div>
    </footer>
  );
}
