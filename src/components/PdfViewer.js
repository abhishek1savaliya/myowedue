"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SpecialZoomLevel, Viewer, Worker } from "@react-pdf-viewer/core";
import { zoomPlugin } from "@react-pdf-viewer/zoom";
import "@react-pdf-viewer/zoom/lib/styles/index.css";

/** Prefer same-origin worker (see `scripts/copy-pdf-worker.mjs` + postinstall). Must match `pdfjs-dist` in package.json. */
const PDF_WORKER_LOCAL = "/pdf.worker.min.js";
const PDF_WORKER_CDN = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

function clampScale(scale) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function pinchDistance(touches) {
  if (touches.length < 2) return 0;
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/**
 * Loads PDF bytes on the main thread (with cookies) then hands them to PDF.js.
 * Uses a blob: URL for reliable loading. Zoom: Ctrl/Cmd + scroll (via zoom plugin + Meta wheel),
 * keyboard shortcuts (Ctrl/Cmd +/-, 0), and two-finger pinch on touch devices.
 */
export default function PdfViewer({ fileUrl, className = "" }) {
  const [docUrl, setDocUrl] = useState(null);
  const [error, setError] = useState(null);
  /** null until we know whether `public/pdf.worker.min.js` exists (never mount Worker with a missing URL). */
  const [workerUrl, setWorkerUrl] = useState(null);

  /** Must be top-level (not inside useMemo): zoomPlugin uses Hooks internally. */
  const zoomPluginInstance = zoomPlugin({ enableShortcuts: true });
  const zoomRef = useRef(zoomPluginInstance);
  zoomRef.current = zoomPluginInstance;
  const scaleRef = useRef(1);
  const pinchRef = useRef(null);
  const scrollRef = useRef(null);
  const rafPinchRef = useRef(0);

  const onZoom = useCallback((e) => {
    scaleRef.current = e.scale;
  }, []);

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

  /** Cmd/Ctrl + wheel where the plugin only listens for Ctrl (e.g. some Safari cases). */
  useEffect(() => {
    if (!docUrl || !workerUrl) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;

    const onWheelMeta = (e) => {
      if (!e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomRef.current.zoomTo(clampScale(scaleRef.current * factor));
    };

    el.addEventListener("wheel", onWheelMeta, { passive: false });
    return () => el.removeEventListener("wheel", onWheelMeta);
  }, [docUrl, workerUrl]);

  /** Two-finger pinch → zoom (plugin handles Ctrl + scroll on desktop). */
  useEffect(() => {
    if (!docUrl || !workerUrl) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        const dist = pinchDistance(e.touches);
        if (dist > 1) {
          pinchRef.current = { dist, scale: scaleRef.current };
        }
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const dist = pinchDistance(e.touches);
      const { dist: d0, scale: s0 } = pinchRef.current;
      if (dist < 1 || d0 < 1) return;
      const next = clampScale((s0 * dist) / d0);
      if (rafPinchRef.current) cancelAnimationFrame(rafPinchRef.current);
      rafPinchRef.current = requestAnimationFrame(() => {
        rafPinchRef.current = 0;
        zoomRef.current.zoomTo(next);
      });
    };

    const endPinch = () => {
      pinchRef.current = null;
      if (rafPinchRef.current) {
        cancelAnimationFrame(rafPinchRef.current);
        rafPinchRef.current = 0;
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", endPinch);
    el.addEventListener("touchcancel", endPinch);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", endPinch);
      el.removeEventListener("touchcancel", endPinch);
      endPinch();
    };
  }, [docUrl, workerUrl]);

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
    <div className={`relative h-full min-h-[50dvh] w-full min-w-0 ${className}`}>
      <Worker key={workerUrl} workerUrl={workerUrl}>
        <div
          ref={scrollRef}
          className="absolute inset-0 min-h-0 touch-pan-x touch-pan-y overflow-auto [-webkit-overflow-scrolling:touch]"
        >
          <Viewer
            fileUrl={docUrl}
            defaultScale={SpecialZoomLevel.PageFit}
            plugins={[zoomPluginInstance]}
            onZoom={onZoom}
          />
        </div>
      </Worker>
    </div>
  );
}
