import Sidebar from "@/components/Sidebar";
import AmbientBackground from "@/components/shell/AmbientBackground";

export default function AppLayout({ children }) {
  return (
    <div className="ui-v2-page relative flex min-h-dvh w-full max-w-full flex-col overflow-x-clip bg-background text-foreground md:flex-row">
      <AmbientBackground />
      <Sidebar />
      <main className="relative z-10 w-full min-w-0 flex-1 overflow-x-clip p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:p-8 md:pb-8">
        {children}
      </main>
    </div>
  );
}
