"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FolderOpen, Globe, LoaderCircle, Lock, PlayCircle } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";

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
  return file?.resourceType === "image" || String(file?.mimeType || "").startsWith("image/");
}

function isVideoFile(file) {
  return file?.resourceType === "video" || String(file?.mimeType || "").startsWith("video/");
}

export default function FolderShareClient({ token }) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {folder.files.map((file) => (
              <article key={file.id} className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                {file.previewUrl && isImageFile(file) ? (
                  <img src={file.previewUrl} alt={file.title} className="aspect-[4/3] w-full object-cover" />
                ) : isVideoFile(file) ? (
                  <div className="relative aspect-[4/3] bg-zinc-900">
                    <video src={file.secureUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <PlayCircle className="h-14 w-14 text-white drop-shadow" />
                    </span>
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-zinc-900 text-white">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/70">{file.extension ? `.${file.extension}` : "File"}</p>
                  </div>
                )}
                <div className="space-y-3 p-4">
                  <div>
                    <h2 className="truncate text-lg font-semibold text-black">{file.title}</h2>
                    <p className="mt-1 truncate text-sm text-zinc-500">{file.originalName}</p>
                  </div>
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{formatBytes(file.bytes)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link href={file.sharePath} target="_blank" className="rounded-full border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700">
                      View File Link
                    </Link>
                    {file.isPublic ? (
                      <a href={`/api/file-share/${file.shareToken}/download`} className="rounded-full bg-black px-3 py-2 text-xs font-semibold text-white">
                        Download
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
