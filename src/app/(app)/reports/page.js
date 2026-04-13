"use client";

import { useRef, useState } from "react";
import { toJpeg } from "html-to-image";

export default function ReportsPage() {
  const cardRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  async function downloadJpg() {
    if (!cardRef.current) return;
    setDownloading(true);
    const dataUrl = await toJpeg(cardRef.current, { quality: 0.95, backgroundColor: "#ffffff" });
    const link = document.createElement("a");
    link.download = "dues-share.jpg";
    link.href = dataUrl;
    link.click();
    setDownloading(false);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-zinc-600">Download PDF/CSV reports and share as image.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <a
          href="/api/export/pdf"
          className="rounded-2xl border border-black bg-black p-4 text-center text-sm font-medium text-white"
        >
          Download PDF
        </a>
        <a
          href="/api/export?type=csv"
          className="rounded-2xl border border-zinc-300 bg-white p-4 text-center text-sm font-medium text-black"
        >
          Download CSV
        </a>
        <button
          onClick={downloadJpg}
          className="rounded-2xl border border-zinc-300 bg-white p-4 text-sm font-medium text-black"
        >
          {downloading ? "Generating JPG..." : "Export as JPG"}
        </button>
      </div>

      <div
        ref={cardRef}
        className="max-w-2xl rounded-3xl border border-zinc-300 bg-white p-5 shadow-[0_20px_70px_rgba(0,0,0,0.1)] sm:p-8"
      >
        <h2 className="text-2xl font-semibold tracking-[0.08em]">Dues Snapshot</h2>
        <p className="mt-2 text-sm text-zinc-600">Personal Credit/Debit Manager</p>
        <ul className="mt-6 space-y-2 text-sm text-zinc-700">
          <li>- Includes person, amount, date and status.</li>
          <li>- Use this snapshot for WhatsApp or quick updates.</li>
          <li>- Generate latest PDF for complete breakdown.</li>
        </ul>
      </div>
    </div>
  );
}
