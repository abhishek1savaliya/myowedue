"use client";

import { SpecialZoomLevel, Viewer, Worker } from "@react-pdf-viewer/core";

const PDF_WORKER_URL = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

export default function PdfViewer({ fileUrl, className = "" }) {
  if (!fileUrl) return null;

  return (
    <div className={className}>
      <Worker workerUrl={PDF_WORKER_URL}>
        <Viewer fileUrl={fileUrl} defaultScale={SpecialZoomLevel.PageFit} />
      </Worker>
    </div>
  );
}

