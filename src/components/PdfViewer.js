"use client";

import { useEffect, useState } from "react";
import { SpecialZoomLevel, Viewer, Worker } from "@react-pdf-viewer/core";

const PDF_WORKER_URL = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

/**
 * Loads PDF bytes on the main thread (with cookies) then hands them to PDF.js.
 * Relying on the worker to fetch same-origin /api/... URLs often omits auth cookies and returns 401.
 */
export default function PdfViewer({ fileUrl, className = "" }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!fileUrl) {
      setData(null);
      setError(null);
      return;
    }

    if (fileUrl instanceof Uint8Array) {
      setData(fileUrl);
      setError(null);
      return;
    }

    const url = typeof fileUrl === "string" ? fileUrl.trim() : "";
    if (!url) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setData(null);
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
        setData(new Uint8Array(buffer));
      } catch (caught) {
        if (!cancelled) {
          setError(caught?.message || "Failed to load PDF");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  if (!fileUrl) return null;

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-rose-600 p-4 text-center text-sm text-white ${className}`}>
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`flex items-center justify-center text-sm text-zinc-500 ${className}`}>Loading PDF…</div>
    );
  }

  return (
    <div className={className}>
      <Worker workerUrl={PDF_WORKER_URL}>
        <Viewer fileUrl={data} defaultScale={SpecialZoomLevel.PageFit} />
      </Worker>
    </div>
  );
}
