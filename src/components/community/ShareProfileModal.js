"use client";

import { useMemo, useState } from "react";
import { Check, Camera, Link2, Loader2, Send, X } from "lucide-react";

/**
 * Share sheet for a community profile (instagram/whatsapp/copy link).
 * @param {{ username: string; displayName?: string; onClose: () => void }} props
 */
export default function ShareProfileModal({ username, displayName, onClose }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/community/user/${encodeURIComponent(username)}`;
  }, [username]);

  const shareText = useMemo(() => {
    const handle = username ? `@${username}` : "this profile";
    const name = displayName ? `${displayName} (${handle})` : handle;
    return `Check out ${name} on OWE DUE Community: ${shareUrl}`;
  }, [username, displayName, shareUrl]);

  async function copyLink() {
    if (!shareUrl || busy) return;
    setBusy(true);
    setCopied(false);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    } finally {
      setBusy(false);
    }
  }

  async function shareWhatsApp() {
    if (!shareUrl || busy) return;
    setBusy(true);
    try {
      const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

  async function shareInstagram() {
    if (!shareUrl || busy) return;
    setBusy(true);
    try {
      // Instagram doesn't support a reliable web "share link" intent.
      // Best UX: copy link and open Instagram; user pastes link into bio/story/message.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-profile-title"
    >
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h2 id="share-profile-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Share profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 shadow-inner dark:border-zinc-600 dark:bg-zinc-950/80">
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{displayName || "Member"}</p>
            <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">@{username}</p>
            <p className="mt-3 break-all text-xs text-zinc-500 dark:text-zinc-400">{shareUrl}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void shareInstagram()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              Instagram
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void shareWhatsApp()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              WhatsApp
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void copyLink()}
              className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

