/** Shared premium ambient gradients (landing + app + auth). */
export default function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="landing-blob landing-blob-a pointer-events-none absolute -left-32 top-0 h-[380px] w-[380px] rounded-full opacity-50" aria-hidden />
      <div className="landing-blob landing-blob-b pointer-events-none absolute -right-20 top-[35%] h-[340px] w-[340px] rounded-full opacity-40" aria-hidden />
      <div className="landing-blob landing-blob-c pointer-events-none absolute bottom-0 left-1/4 h-[280px] w-[280px] rounded-full opacity-35" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(245,158,11,0.12),transparent)]"
        aria-hidden
      />
    </div>
  );
}
