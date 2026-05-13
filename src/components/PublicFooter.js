import Link from "next/link";
import { Award, Bell, Scale, Shield, Users } from "lucide-react";

const TRUST_BADGES = [
  { icon: Shield, label: "Bank-level security" },
  { icon: Bell, label: "Smart reminders" },
  { icon: Scale, label: "Credit & debit tracking" },
  { icon: Users, label: "Community insights" },
  { icon: Award, label: "Your data, your control" },
];

export default function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#121619] text-white">
      <div className="mx-auto max-w-6xl px-6 pb-10 pt-14 sm:px-8 sm:pb-12 sm:pt-16">
        <div className="grid grid-cols-1 gap-8 border-b border-white/10 pb-12 sm:grid-cols-2 sm:pb-14 lg:flex lg:flex-nowrap lg:items-center lg:justify-between lg:gap-6">
          {TRUST_BADGES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex min-w-0 items-center gap-3 lg:max-w-[11rem] lg:flex-1 xl:max-w-none">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-800/90 text-zinc-300 ring-1 ring-white/10">
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <p className="text-[11px] font-bold uppercase leading-snug tracking-[0.12em] text-white sm:text-xs">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-5 text-sm sm:mt-12 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <p className="text-zinc-500">
            © {year}{" "}
            <span className="font-semibold text-white">MyOwedue</span>. All rights reserved.
          </p>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-white">
            <Link href="/contact-us" className="font-medium transition hover:text-zinc-300">
              Legal info
            </Link>
            <Link href="/privacy-policy" className="font-medium transition hover:text-zinc-300">
              Privacy policy
            </Link>
            <Link href="/contact-us" className="font-medium transition hover:text-zinc-300">
              Do not sell my personal info
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
