"use client";

import { useEffect, useState } from "react";
import { SpecialZoomLevel, Viewer, Worker } from "@react-pdf-viewer/core";

/** Prefer same-origin worker (see `scripts/copy-pdf-worker.mjs` + postinstall). Must match `pdfjs-dist` in package.json. */
const PDF_WORKER_LOCAL = "/pdf.worker.min.js";
const PDF_WORKER_CDN = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

/**
 * Loads PDF bytes on the main thread (with cookies) then hands them to PDF.js.
 * Relying on the worker to fetch same-origin /api/... URLs often omits auth cookies and returns 401.
 * Uses a blob: URL so mobile Safari and strict embed policies handle the document reliably.
 */
export default function PdfViewer({ fileUrl, className = "" }) {
  const [docUrl, setDocUrl] = useState(null);
  const [error, setError] = useState(null);
  /** null until we know whether `public/pdf.worker.min.js` exists (never mount Worker with a missing URL). */
  const [workerUrl, setWorkerUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(PDF_WORKER_LOCAL, { method: "HEAD", cache: "no-store" });
        if (cancelled) return;
        setWorkerUrl(res.ok ? PDF_WORKER_LOCAL : PDF_WORKER_CDN);
      } catch {
        if (!cancelled) setWorkerUrl(PDF_WORKER_CDN);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!fileUrl) {
      setDocUrl(null);
      setError(null);
      return undefined;
    }

    if (fileUrl instanceof Uint8Array) {
      const blob = new Blob([fileUrl], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setDocUrl(url);
      setError(null);
      return () => URL.revokeObjectURL(url);
    }

    const url = typeof fileUrl === "string" ? fileUrl.trim() : "";
    if (!url) {
      setDocUrl(null);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    let objectUrl = "";
    setDocUrl(null);
    setError(null);

    (async () => {
      try {
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
          let detail = "";
          try {
            const payload = await response.clone().json();
            if (payload?.message) detail = ` ${payload.message}`;
          } catch {
            /* not JSON */
          }
          throw new Error(`Unexpected server response (${response.status}) while retrieving PDF "${url}".${detail}`);
        }
        const buffer = await response.arrayBuffer();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
        setDocUrl(objectUrl);
      } catch (caught) {
        if (!cancelled) {
          setError(caught?.message || "Failed to load PDF");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl]);

  if (!fileUrl) return null;

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 bg-rose-600 p-4 text-center text-sm text-white ${className}`}>
        <p>{error}</p>
        {typeof fileUrl === "string" && fileUrl.startsWith("/") ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold text-white underline decoration-white/80 underline-offset-2 hover:bg-white/25"
          >
            Open PDF in new tab
          </a>
        ) : null}
      </div>
    );
  }

  if (!docUrl || !workerUrl) {
    return (
      <div className={`flex items-center justify-center text-sm text-zinc-500 ${className}`}>Loading PDF…</div>
    );
  }

  return (
    <div className={`relative h-full min-h-[50dvh] w-full min-w-0 touch-pan-y ${className}`}>
      <Worker key={workerUrl} workerUrl={workerUrl}>
        <div className="absolute inset-0 min-h-0 overflow-auto [-webkit-overflow-scrolling:touch]">
          <Viewer fileUrl={docUrl} defaultScale={SpecialZoomLevel.PageFit} />
        </div>
      </Worker>
    </div>
  );
}
