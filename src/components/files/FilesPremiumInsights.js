"use client";

import { FileImage, FileText, Film, Folder, Gem, HardDrive } from "lucide-react";
import { formatFileBytes } from "@/lib/files-insights";
import { uiCard } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const TYPE_LABELS = {
  image: "Images",
  video: "Videos",
  pdf: "PDFs",
  other: "Other",
};

function MetricTile({ label, value, hint, tone = "default" }) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-500/25 bg-emerald-500/10"
      : tone === "amber"
        ? "border-amber-500/25 bg-amber-500/10"
        : tone === "sky"
          ? "border-sky-500/25 bg-sky-500/10"
          : "border-zinc-200/80 bg-zinc-50/80 dark:border-white/10 dark:bg-white/[0.03]";

  return (
    <div className={cn("rounded-xl border p-4", toneClass)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
    </div>
  );
}

/**
 * @param {{ insights: import("@/lib/files-insights").buildFilesInsights extends (...args: never) => infer R ? R : never }} props
 */
export default function FilesPremiumInsights({ insights }) {
  if (!insights) return null;

  const typeRows = ["image", "video", "pdf", "other"].filter((key) => insights.typeCounts[key] > 0);

  return (
    <section
      className={cn(
        "premium-insight-card premium-insight-card--advanced relative overflow-hidden",
        uiCard,
        "p-5 sm:p-6"
      )}
    >
      <div className="premium-insight-card-glow pointer-events-none" aria-hidden />

      <header className="relative flex flex-wrap items-start gap-3">
        <div className="premium-insight-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
          <HardDrive className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">Files insights</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">
              <Gem className="h-3 w-3" aria-hidden />
              Pro
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Storage breakdown, sharing, and largest files
          </p>
        </div>
      </header>

      <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Storage used"
          value={`${insights.usagePercent}%`}
          hint={`${formatFileBytes(insights.usageBytes)} of ${formatFileBytes(insights.quotaBytes)}`}
          tone="amber"
        />
        <MetricTile
          label="Files"
          value={String(insights.fileCount)}
          hint={`${insights.unfiledCount} not in a folder`}
          tone="sky"
        />
        <MetricTile
          label="Folders"
          value={String(insights.folderCount)}
          hint={`${insights.passwordFolders} password · ${insights.publicFolders} public`}
        />
        <MetricTile
          label="Shared files"
          value={String(insights.publicCount)}
          hint={`${insights.privateCount} private`}
          tone="emerald"
        />
      </div>

      <div className="relative mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-white/8 dark:bg-white/3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">By type</p>
          <ul className="mt-3 space-y-2">
            {typeRows.length ? (
              typeRows.map((key) => (
                <li key={key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-foreground">{TYPE_LABELS[key]}</span>
                  <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
                    {insights.typeCounts[key]} · {formatFileBytes(insights.typeBytes[key])}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-sm text-zinc-500">No files yet.</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-white/8 dark:bg-white/3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Largest files</p>
          <ul className="mt-3 space-y-2">
            {insights.topLargest.length ? (
              insights.topLargest.map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-foreground">{file.name}</span>
                  <span className="shrink-0 tabular-nums font-semibold text-amber-700 dark:text-amber-300">
                    {formatFileBytes(file.bytes)}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-sm text-zinc-500">No files to rank yet.</li>
            )}
          </ul>
        </div>
      </div>

      <p className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1">
          <Folder className="h-3.5 w-3.5" aria-hidden />
          {insights.filesInFolders} files organized in folders
        </span>
        <span className="inline-flex items-center gap-1 capitalize">
          {insights.dominantType === "pdf" ? (
            <FileText className="h-3.5 w-3.5" aria-hidden />
          ) : insights.dominantType === "video" ? (
            <Film className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <FileImage className="h-3.5 w-3.5" aria-hidden />
          )}
          Most storage: {TYPE_LABELS[insights.dominantType] || "Other"}
        </span>
      </p>
    </section>
  );
}
