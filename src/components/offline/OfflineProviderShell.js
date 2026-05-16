"use client";

import dynamic from "next/dynamic";

const OfflineProvider = dynamic(() => import("@/components/offline/OfflineProvider"), {
  ssr: false,
  loading: () => null,
});

/** Loads offline sync + fetch patch only in the browser (avoids server bundling Node deps). */
export default function OfflineProviderShell({ children }) {
  return <OfflineProvider>{children}</OfflineProvider>;
}
