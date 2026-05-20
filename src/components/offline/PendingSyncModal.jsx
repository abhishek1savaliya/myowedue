"use client";

import { X } from "lucide-react";

/**
 * @param {{
 *   open: boolean;
 *   items: Array<{ id?: number; method?: string; url?: string; createdAt?: number; retries?: number; lastError?: string }>;
 *   progress: { processed: number; total: number; synced: number; failed: number } | null;
 *   syncing: boolean;
 *   onClose: () => void;
 *   onSyncNow: () => void;
 * }} props
 */
export default function PendingSyncModal({ open, items, progress, syncing, onClose, onSyncNow }) {
  if (!open) return null;

  const total = progress?.total || items.length || 0;
  const processed = Math.min(progress?.processed || 0, total);
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-250 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Pending sync tasks</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-white/10">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
            <span>{syncing ? `Syncing ${processed}/${total}` : `${items.length} pending`}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
          {progress ? (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Synced: {progress.synced} · Failed: {progress.failed}
            </p>
          ) : null}
        </div>

        <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
          {items.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No pending items.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-xl border border-zinc-200 p-2.5 text-xs dark:border-white/10">
                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                  {item.method || "POST"} {item.url || ""}
                </p>
                <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                  Queued: {item.createdAt ? new Date(item.createdAt).toLocaleString() : "unknown"} · Retries: {item.retries || 0}
                </p>
                {item.lastError ? <p className="mt-1 text-rose-600">{item.lastError}</p> : null}
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 dark:border-white/20 dark:bg-transparent dark:text-zinc-200"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onSyncNow}
            disabled={syncing || items.length === 0}
            className="rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            Sync now
          </button>
        </div>
      </div>
    </div>
  );
}
