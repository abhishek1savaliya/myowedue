import Sidebar from "@/components/Sidebar";
import AmbientBackground from "@/components/shell/AmbientBackground";
import { startReminderCron } from "@/lib/cron";

startReminderCron();

export default function AppLayout({ children }) {
  return (
    <div className="ui-v2-page relative min-h-screen bg-[#030712] text-zinc-100 md:flex">
      <AmbientBackground />
      <Sidebar />
      <main className="relative z-10 min-w-0 flex-1 overflow-x-hidden p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-8 md:pb-8">
        {children}
      </main>
    </div>
  );
}
