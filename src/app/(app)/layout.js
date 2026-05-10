import Sidebar from "@/components/Sidebar";
import { startReminderCron } from "@/lib/cron";

startReminderCron();

export default function AppLayout({ children }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground md:flex">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,0.08),transparent_36%),radial-gradient(circle_at_90%_100%,rgba(16,185,129,0.08),transparent_38%)]" />
      <Sidebar />
      <main className="relative min-w-0 flex-1 overflow-x-hidden p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-8 md:pb-8">
        {children}
      </main>
    </div>
  );
}
