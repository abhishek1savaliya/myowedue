import Sidebar from "@/components/Sidebar";
import { startReminderCron } from "@/lib/cron";

startReminderCron();

export default function AppLayout({ children }) {
  return (
    <div className="relative min-h-screen bg-stone-100 md:flex">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,0.12),transparent_35%),radial-gradient(circle_at_90%_100%,rgba(16,185,129,0.12),transparent_36%)]" />
      <Sidebar />
      <main className="relative flex-1 p-4 pb-6 md:p-8">{children}</main>
    </div>
  );
}
