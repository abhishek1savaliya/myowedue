import AmbientBackground from "@/components/shell/AmbientBackground";

export default function AuthLayout({ children }) {
  return (
    <main className="ui-v2-page relative flex min-h-dvh flex-col justify-center overflow-x-hidden bg-background px-4 py-10 text-foreground sm:px-6 sm:py-12 md:px-8">
      <AmbientBackground />
      <div className="relative z-10 mx-auto w-full max-w-[min(100%,28rem)]">{children}</div>
    </main>
  );
}
