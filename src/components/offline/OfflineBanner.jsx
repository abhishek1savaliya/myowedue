"use client";

import { CloudOff, CloudUpload, RefreshCw, Wifi } from "lucide-react";

/**
 * @param {{
 *   online: boolean;
 *   pending: number;
 *   syncing: boolean;
 *   lastSync: { synced: number; failed: number; remaining: number } | null;
 *   syncProgress?: { processed: number; total: number } | null;
 *   onSyncNow: () => void;
 *   onViewPending: () => void;
 * }} props
 */
export default function OfflineBanner({ online, pending, syncing, lastSync, syncProgress, onSyncNow, onViewPending }) {
  const showOffline = !online;
  const showPending = pending > 0;
  const showBackOnline = online && lastSync?.synced > 0;

  if (!showOffline && !showPending && !showBackOnline) return null;

  return (
    <div
      className={`fixed bottom-4 left-1/2 z-200 flex max-w-[min(100vw-2rem,28rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md ${
        showOffline
          ? "border-amber-500/40 bg-amber-950/90 text-amber-50"
          : "border-emerald-500/35 bg-emerald-950/90 text-emerald-50"
      }`}
      role="status"
    >
      {showOffline ? (
        <CloudOff className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
      ) : syncing ? (
        <RefreshCw className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Wifi className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
      )}

      <div className="min-w-0 flex-1">
        {showOffline ? (
          <>
            <p className="font-semibold">You&apos;re offline</p>
            <p className="text-xs opacity-90">
              Viewing saved data. Changes queue until you reconnect.
              {pending > 0 ? ` ${pending} pending.` : ""}
            </p>
          </>
        ) : showPending ? (
          <>
            <p className="font-semibold">Syncing changes…</p>
            <p className="text-xs opacity-90">{pending} item(s) waiting to upload</p>
          </>
        ) : (
          <>
            <p className="font-semibold">Back online</p>
            <p className="text-xs opacity-90">
              Synced {lastSync.synced} change{lastSync.synced === 1 ? "" : "s"}
              {lastSync.failed > 0 ? ` · ${lastSync.failed} failed` : ""}
            </p>
          </>
        )}
        {syncing && (syncProgress?.total || pending) > 0 ? (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-emerald-300 transition-all"
              style={{
                width: `${Math.min(
                  100,
                  Math.round((((syncProgress?.processed || 0) / Math.max(1, syncProgress?.total || pending)) * 100))
                )}%`,
              }}
            />
          </div>
        ) : null}
      </div>

      {online && (showPending || pending > 0) ? (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onViewPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"
          >
            View
          </button>
          <button
            type="button"
            onClick={onSyncNow}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25 disabled:opacity-50"
          >
            <CloudUpload className="h-3.5 w-3.5" />
            Sync
          </button>
        </div>
      ) : null}
    </div>
  );
}
