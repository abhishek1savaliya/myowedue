import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="relative border-t border-zinc-800/80 bg-zinc-950/95">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-zinc-300 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-100">MYOWEDUE</p>
          <p className="mt-1 text-xs text-zinc-400">Premium personal credit and debit management.</p>
        </div>
        <nav className="flex flex-wrap gap-4 text-xs font-medium uppercase tracking-wide text-zinc-400">
          <Link href="/signup" className="transition hover:text-zinc-100">
            Sign up
          </Link>
          <Link href="/login" className="transition hover:text-zinc-100">
            Login
          </Link>
          <Link href="/privacy-policy" className="transition hover:text-zinc-100">
            Privacy policy
          </Link>
          <Link href="/contact-us" className="transition hover:text-zinc-100">
            Contact us
          </Link>
        </nav>
      </div>
    </footer>
  );
}
