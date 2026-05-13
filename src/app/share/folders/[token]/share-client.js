"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Globe, Grid2x2, LayoutGrid, List, LoaderCircle, Lock, PlayCircle, Rows3, X } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";
import ModalPortal from "@/components/ModalPortal";
import PdfViewer from "@/components/PdfViewer";
import { isPdfFile } from "@/lib/file-storage-utils";

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value;
  let unit = -1;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

function isImageFile(file) {
  return !isPdfFile(file) && (file?.resourceType === "image" || String(file?.mimeType || "").startsWith("image/"));
}

function isVideoFile(file) {
  return file?.resourceType === "video" || String(file?.mimeType || "").startsWith("video/");
}

function canPreviewInModal(file) {
  return Boolean(file?.folderOpenUrl) && (isPdfFile(file) || isImageFile(file) || isVideoFile(file));
}

/** Suggested filename for the HTML `download` attribute (mobile Safari). */
function downloadAttributeName(file) {
  const base = String(file?.originalName || file?.title || "download").trim() || "download";
  const leaf = base.includes("/") ? base.split("/").pop() : base;
  const safe = leaf.replace(/[^a-zA-Z0-9._\- ]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120);
  return safe || "download";
}

const FOLDER_SHARE_VIEW_STORAGE_KEY = "owedue:folder-share-file-view";

const FILE_VIEW_OPTIONS = [
  { key: "list", label: "List", icon: List },
  { key: "small", label: "Small", icon: Rows3 },
  { key: "medium", label: "Medium", icon: Grid2x2 },
  { key: "large", label: "Large", icon: LayoutGrid },
];

const FILE_VIEW_CLASSES = {
  list: {
    grid: "grid gap-3",
    card: "flex min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]",
    preview: "h-24 w-24 shrink-0",
    info: "min-w-0 flex-1 p-4",
    title: "truncate text-base font-semibold text-black",
  },
  small: {
    grid: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6",
    card: "overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]",
    preview: "aspect-square w-full",
    info: "space-y-2 p-3",
    title: "truncate text-sm font-semibold text-black",
  },
  medium: {
    grid: "grid gap-4 md:grid-cols-2 xl:grid-cols-3",
    card: "overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]",
    preview: "aspect-[4/3] w-full",
    info: "space-y-3 p-4",
    title: "truncate text-lg font-semibold text-black",
  },
  large: {
    grid: "grid gap-5 lg:grid-cols-2",
    card: "overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]",
    preview: "aspect-video w-full",
    info: "space-y-3 p-5",
    title: "truncate text-xl font-semibold text-black",
  },
};

export default function FolderShareClient({ token }) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [fileView, setFileView] = useState("medium");
  const [previewFile, setPreviewFile] = useState(null);

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/folder-share/${token}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.message || "Failed to open shared folder.");
      setLoading(false);
      return;
    }
    setPayload(data);
    setLoading(false);
  }

  async function unlockFolder(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const response = await fetch(`/api/folder-share/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await response.json().catch(() => ({}));
    setSubmitting(false);

    if (!response.ok) {
      setMessage(data.message || "Could not unlock this folder.");
      return;
    }

    setPayload(data);
    setPassword("");
  }

  useEffect(() => {
    load();
  }, [token]);

  useEffect(() => {
    const savedView = window.localStorage.getItem(FOLDER_SHARE_VIEW_STORAGE_KEY);
    if (FILE_VIEW_OPTIONS.some((option) => option.key === savedView)) {
      setFileView(savedView);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FOLDER_SHARE_VIEW_STORAGE_KEY, fileView);
  }, [fileView]);

  useEffect(() => {
    if (!previewFile) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") setPreviewFile(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewFile]);

  if (loading) {
    return (
      <main className="min-h-screen bg-stone-100 px-6 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-[0_20px_70px_rgba(0,0,0,0.08)]">
          <Loader label="Loading shared folder..." />
        </div>
      </main>
    );
  }

  if (!payload?.folder) {
    return (
      <main className="min-h-screen bg-stone-100 px-6 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-[0_20px_70px_rgba(0,0,0,0.08)]">
          <h1 className="text-3xl font-semibold text-black">Shared folder unavailable</h1>
          <p className="mt-3 text-sm text-zinc-600">{message || "This folder link is missing or no longer active."}</p>
        </div>
      </main>
    );
  }

  const { folder, access } = payload;
  const fileViewClasses = FILE_VIEW_CLASSES[fileView] || FILE_VIEW_CLASSES.medium;

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-10 sm:px-6 sm:py-14">
      <section className="mx-auto max-w-6xl space-y-6">
        <article className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-[0_20px_70px_rgba(0,0,0,0.08)] sm:p-8">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
              folder.permissionType === "public" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-900 text-white"
            }`}
          >
            {folder.permissionType === "public" ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {folder.permissionType === "public" ? "Public Folder" : folder.permissionType === "password" ? "Password Folder" : "Private Folder"}
          </span>
          <div className="mt-5 flex items-start gap-4">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white">
              <FolderOpen className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-3xl font-semibold text-black">{folder.name}</h1>
              <p className="mt-2 text-sm leading-7 text-zinc-600">
                Shared by {folder.ownerName}. {folder.description || `${folder.fileCount} linked files in this folder.`}
              </p>
            </div>
          </div>
        </article>

        {access?.requiresPassword ? (
          <form onSubmit={unlockFolder} className="mx-auto max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_20px_70px_rgba(0,0,0,0.08)]">
            <h2 className="text-xl font-semibold text-black">Enter folder password</h2>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-4 w-full rounded-xl border border-zinc-300 px-3 py-3"
              placeholder="Password"
            />
            {message ? <p className="mt-3 text-sm text-rose-600">{message}</p> : null}
            <button
              type="submit"
              disabled={submitting || !password}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Unlock Folder
            </button>
          </form>
        ) : access?.isPrivate ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-[0_20px_70px_rgba(0,0,0,0.08)]">
            This folder is private. Ask the owner to make it public or password protected.
          </div>
        ) : folder.files.length === 0 ? (
          <EmptyState text="No files are linked in this folder." />
        ) : (
          <>
            <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Display</p>
                <p className="mt-1 text-sm text-zinc-600">{folder.files.length} files shown</p>
              </div>
              <div className="grid grid-cols-4 gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1">
                {FILE_VIEW_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const active = fileView === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setFileView(option.key)}
                      title={`${option.label} view`}
                      aria-label={`${option.label} view`}
                      aria-pressed={active}
                      className={`inline-flex h-9 min-w-10 items-center justify-center rounded-lg px-2 text-xs font-semibold ${
                        active ? "bg-black text-white shadow-sm" : "text-zinc-600 hover:bg-white"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="sr-only">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

          <div className={fileViewClasses.grid}>
            {folder.files.map((file) => (
              <article key={file.id} className={fileViewClasses.card}>
                {canPreviewInModal(file) ? (
                  <button
                    type="button"
                    onClick={() => setPreviewFile(file)}
                    className={`group relative block w-full overflow-hidden bg-zinc-100 p-0 text-left ${fileViewClasses.preview} focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2`}
                    aria-label={`View ${file.title}`}
                  >
                    {file.previewUrl && isImageFile(file) ? (
                      <img
                        src={file.previewUrl}
                        alt={file.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                      />
                    ) : isVideoFile(file) ? (
                      <>
                        <video
                          src={file.folderOpenUrl}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/30">
                          <PlayCircle className="h-14 w-14 text-white drop-shadow" />
                        </span>
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-white">
                        <p className="text-xs uppercase tracking-[0.22em] text-white/70">{isPdfFile(file) ? "PDF" : "View"}</p>
                      </div>
                    )}
                  </button>
                ) : file.previewUrl && isImageFile(file) ? (
                  <img src={file.previewUrl} alt={file.title} loading="lazy" decoding="async" className={`${fileViewClasses.preview} object-cover`} />
                ) : isVideoFile(file) ? (
                  <div className={`relative bg-zinc-900 ${fileViewClasses.preview}`}>
                    <video src={file.folderOpenUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <PlayCircle className="h-14 w-14 text-white drop-shadow" />
                    </span>
                  </div>
                ) : (
                  <div className={`flex items-center justify-center bg-zinc-900 text-white ${fileViewClasses.preview}`}>
                    <p className="text-xs uppercase tracking-[0.22em] text-white/70">{file.extension ? `.${file.extension}` : "File"}</p>
                  </div>
                )}
                <div className={fileViewClasses.info}>
                  <div>
                    <h2 className={fileViewClasses.title}>{file.title}</h2>
                    <p className="mt-1 truncate text-sm text-zinc-500">{file.originalName}</p>
                  </div>
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{formatBytes(file.bytes)}</p>
                  <div className="flex flex-wrap gap-2">
                    {canPreviewInModal(file) ? (
                      <button
                        type="button"
                        onClick={() => setPreviewFile(file)}
                        className="rounded-full border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        View
                      </button>
                    ) : (
                      <a
                        href={file.folderOpenUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700"
                      >
                        Open
                      </a>
                    )}
                    <a
                      href={file.folderDownloadUrl}
                      download={downloadAttributeName(file)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-black px-3 py-2 text-xs font-semibold text-white"
                    >
                      Download
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
          </>
        )}
      </section>

      {previewFile ? (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center overflow-y-auto bg-black/80 px-4 py-6"
            role="dialog"
            aria-modal="true"
            aria-label={previewFile.title}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPreviewFile(null);
            }}
          >
            <div className="relative flex min-h-0 w-full max-w-6xl flex-col">
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="absolute right-0 top-0 z-10 inline-flex h-10 w-10 -translate-y-12 items-center justify-center rounded-full bg-white text-black shadow-lg"
                aria-label="Close preview"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex h-[min(85dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-3rem))] max-h-[85vh] flex-col overflow-hidden rounded-2xl bg-black shadow-2xl">
                {isPdfFile(previewFile) ? (
                  <PdfViewer
                    fileUrl={previewFile.folderOpenUrl}
                    className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-zinc-900"
                  />
                ) : isVideoFile(previewFile) ? (
                  <video
                    key={previewFile.folderOpenUrl}
                    src={previewFile.folderOpenUrl}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[85vh] w-full bg-black object-contain"
                  />
                ) : (
                  <img
                    src={previewFile.folderOpenUrl}
                    alt={previewFile.title}
                    className="max-h-[85vh] w-full object-contain"
                  />
                )}
              </div>
              <div className="mt-3 text-white">
                <p className="text-sm font-semibold">{previewFile.title}</p>
                <p className="mt-1 text-xs text-white/70">{previewFile.originalName}</p>
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </main>
  );
}
