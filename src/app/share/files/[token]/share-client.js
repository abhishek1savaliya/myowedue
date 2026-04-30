"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Globe, LoaderCircle, Lock, PlayCircle, X } from "lucide-react";
import Loader from "@/components/Loader";
import ModalPortal from "@/components/ModalPortal";

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

function isPdfFile(file) {
  return String(file?.mimeType || "").toLowerCase() === "application/pdf" || String(file?.originalName || "").toLowerCase().endsWith(".pdf");
}

function isImageFile(file) {
  return !isPdfFile(file) && (file?.resourceType === "image" || String(file?.mimeType || "").startsWith("image/"));
}

function isVideoFile(file) {
  return file?.resourceType === "video" || String(file?.mimeType || "").startsWith("video/");
}

export default function FileShareClient({ token }) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/file-share/${token}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.message || "Failed to open shared file.");
      setLoading(false);
      return;
    }
    setPayload(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [token]);

  useEffect(() => {
    if (!previewOpen) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") setPreviewOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewOpen]);

  async function requestAccess() {
    setSubmitting(true);
    setMessage("");

    const response = await fetch(`/api/file-share/${token}/request`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setSubmitting(false);

    if (!response.ok) {
      setMessage(data.message || "Could not send access request.");
      return;
    }

    setMessage(data.message || "Access request sent.");
    load();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-stone-100 px-6 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-[0_20px_70px_rgba(0,0,0,0.08)]">
          <Loader label="Loading shared file..." />
        </div>
      </main>
    );
  }

  if (!payload?.file) {
    return (
      <main className="min-h-screen bg-stone-100 px-6 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-[0_20px_70px_rgba(0,0,0,0.08)]">
          <h1 className="text-3xl font-semibold text-black">Shared file unavailable</h1>
          <p className="mt-3 text-sm text-zinc-600">{message || "This link is missing or no longer active."}</p>
        </div>
      </main>
    );
  }

  const { file, access } = payload;
  const loginHref = `/login?next=${encodeURIComponent(`/share/files/${token}`)}`;
  const canPreview = Boolean(file.mediaUrl && (isImageFile(file) || isVideoFile(file)));

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_35%),#f5f5f4] px-6 py-14">
      <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-[0_20px_70px_rgba(0,0,0,0.08)]">
          {canPreview ? (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="group relative block aspect-[4/3] w-full overflow-hidden bg-zinc-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
              aria-label={`Open ${file.title}`}
            >
              {isVideoFile(file) ? (
                <>
                  <video src={file.mediaUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/30">
                    <PlayCircle className="h-14 w-14 text-white drop-shadow" />
                  </span>
                </>
              ) : (
                <img src={file.previewUrl || file.mediaUrl} alt={file.title} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" />
              )}
            </button>
          ) : file.previewUrl ? (
            <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
              <img src={file.previewUrl} alt={`${file.title} preview`} className="h-full w-full object-cover" />
              {isPdfFile(file) ? (
                <span className="absolute left-4 top-4 rounded-full bg-black px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow">
                  PDF
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(135deg,#111827_0%,#1f2937_45%,#4b5563_100%)] text-white">
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.26em] text-white/60">{isPdfFile(file) ? "PDF" : file.resourceType === "video" ? "Video" : file.resourceType === "image" ? "Image" : "File"}</p>
                <p className="mt-4 text-2xl font-semibold">{file.originalName}</p>
              </div>
            </div>
          )}
        </article>

        <article className="rounded-[32px] border border-zinc-200 bg-white p-8 shadow-[0_20px_70px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                file.isPublic ? "bg-emerald-100 text-emerald-700" : "bg-zinc-900 text-white"
              }`}
            >
              {file.isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {file.isPublic ? "Public Link" : "Private Link"}
            </span>
          </div>

          <h1 className="mt-5 text-3xl font-semibold text-black">{file.title}</h1>
          <p className="mt-3 text-sm leading-7 text-zinc-600">
            Shared by {file.ownerName}. {file.isPublic ? "This file is open through the link below." : "This file is private and requires the owner to approve your access request."}
          </p>

          <div className="mt-6 space-y-3 rounded-3xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-black">Original file</span>
              <span>{file.originalName}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-black">Size</span>
              <span>{formatBytes(file.bytes)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-black">Created</span>
              <span>{file.createdAt ? new Date(file.createdAt).toLocaleDateString() : "Unknown"}</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {access?.canDownload ? (
              <a
                href={access.downloadUrl}
                className="inline-flex w-full items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
              >
                Download File
              </a>
            ) : access?.canRequestAccess ? (
              <button
                type="button"
                onClick={requestAccess}
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {submitting ? "Sending request..." : "Request Access"}
              </button>
            ) : access?.requestStatus === "pending" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Your access request is pending approval.
              </div>
            ) : access?.requestStatus === "rejected" ? (
              <button
                type="button"
                onClick={requestAccess}
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 disabled:opacity-60"
              >
                Request Access Again
              </button>
            ) : access?.requestStatus === "login_required" ? (
              <Link href={loginHref} className="inline-flex w-full items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white">
                Sign in to request access
              </Link>
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                This file is waiting for the owner to approve access.
              </div>
            )}

            {message ? <p className="text-sm text-zinc-600">{message}</p> : null}
          </div>
        </article>
      </section>

      {previewOpen ? (
        <ModalPortal>
        <div
          className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center overflow-y-auto bg-black/80 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label={file.title}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewOpen(false);
          }}
        >
          <div className="relative max-h-full w-full max-w-6xl">
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute right-0 top-0 z-10 inline-flex h-10 w-10 -translate-y-12 items-center justify-center rounded-full bg-white text-black shadow-lg"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="max-h-[85vh] overflow-hidden rounded-2xl bg-black shadow-2xl">
              {isVideoFile(file) ? (
                <video key={file.mediaUrl} src={file.mediaUrl} controls autoPlay playsInline className="max-h-[85vh] w-full bg-black object-contain" />
              ) : (
                <img src={file.mediaUrl} alt={file.title} className="max-h-[85vh] w-full object-contain" />
              )}
            </div>
            <div className="mt-3 text-white">
              <p className="text-sm font-semibold">{file.title}</p>
              <p className="mt-1 text-xs text-white/70">{file.originalName}</p>
            </div>
          </div>
        </div>
        </ModalPortal>
      ) : null}
    </main>
  );
}
