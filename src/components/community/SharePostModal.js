"use client";

import { useCallback, useState } from "react";
import { Image as ImageIcon, Link2, Loader2, Share2, X } from "lucide-react";

/**
 * Share sheet with a post “preview” card, copy link, and device share. Counts a share on success.
 * @param {{ post: { id: string; body: string; author_name?: string }; onClose: () => void; onShared?: (nextCount: number) => void }} props
 */
export default function SharePostModal({ post, onClose, onShared }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/community/post/${encodeURIComponent(post.id)}` : "";

  const recordShare = useCallback(async () => {
    const res = await fetch(`/api/community/posts/${post.id}/share`, { method: "POST", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data.shareCount === "number") onShared?.(data.shareCount);
  }, [post.id, onShared]);

  async function copyLink() {
    if (!shareUrl || busy) return;
    setBusy(true);
    setCopied(false);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      await recordShare();
    } catch {
      setCopied(false);
    } finally {
      setBusy(false);
    }
  }

  async function deviceShare() {
    if (busy) return;
    setBusy(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: "OWE DUE Community",
          text: String(post.body || "").slice(0, 160),
          url: shareUrl,
        });
      } else if (shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
      }
      await recordShare();
    } catch {
      /* dismissed */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="share-post-title">
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 dark:border-zinc-800">
          <h2 id="share-post-title" className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Share post
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-zinc-500 hover:bg-stone-100 dark:hover:bg-zinc-800" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <ImageIcon className="h-3.5 w-3.5" aria-hidden />
              Post preview
            </p>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 shadow-inner dark:border-zinc-600 dark:bg-slate-950/80">
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{post.author_name || "Member"}</p>
              <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-100">{post.body}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => void copyLink()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-3 text-sm font-semibold text-zinc-800 hover:bg-stone-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-slate-800 dark:text-zinc-100 dark:hover:bg-slate-800/80"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void deviceShare()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              Share…
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
