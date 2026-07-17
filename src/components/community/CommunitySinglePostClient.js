"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import BackButton from "@/components/BackButton";
import { PostCard } from "@/components/community/CommunityFeedClient";
import SharePostModal from "@/components/community/SharePostModal";
import { dispatchCommunityMutate } from "@/lib/community-mutate-event";
import { useUserStore } from "@/stores/useUserStore";

/**
 * @param {{ postId: string; loginNextPath: string; backHref: string; skin: "x" | "default"; initialPost?: object | null }} props
 */
export default function CommunitySinglePostClient({ postId, loginNextPath, backHref, skin, initialPost = null }) {
  const router = useRouter();
  const hasInitialPost = Boolean(initialPost && String(initialPost.id) === String(postId));
  const [post, setPost] = useState(hasInitialPost ? initialPost : null);
  const [loading, setLoading] = useState(!hasInitialPost);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [shareTarget, setShareTarget] = useState(null);
  const isX = skin === "x";
  const sessionUserId = useUserStore((s) => s.user?.id || "");
  const viewerUserId = currentUserId || sessionUserId;

  const loadPost = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const res = await fetch(`/api/community/posts/${postId}`, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to load post");
      let nextPost = data.post || null;
      setCurrentUserId(data.currentUserId || useUserStore.getState().user?.id || "");

      // Belt-and-suspenders: confirm liked from dedicated endpoint (SEO seed / cache can omit it).
      if (nextPost && (data.currentUserId || useUserStore.getState().user?.id)) {
        try {
          const likedRes = await fetch("/api/community/me/liked-ids", {
            credentials: "include",
            cache: "no-store",
          });
          const likedData = await likedRes.json().catch(() => ({}));
          if (likedRes.ok && Array.isArray(likedData.ids)) {
            const liked = likedData.ids.map(String).includes(String(nextPost.id));
            if (liked !== Boolean(nextPost.liked)) {
              let likeCount = Number(nextPost.likeCount || 0);
              if (liked && !nextPost.liked) likeCount += 1;
              if (!liked && nextPost.liked) likeCount = Math.max(0, likeCount - 1);
              nextPost = { ...nextPost, liked, likeCount };
            }
            if (likedData.currentUserId) setCurrentUserId(String(likedData.currentUserId));
          }
        } catch {
          /* non-critical */
        }
      }

      setPost(nextPost);
    } catch (e) {
      if (!silent) {
        setError(e.message || "Failed to load");
        setPost(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    // Always hydrate with credentials so liked hearts survive refresh after SEO seed.
    void loadPost({ silent: hasInitialPost });
  }, [loadPost, hasInitialPost]);

  const canInteract = Boolean(viewerUserId);

  const onLikeToggle = useCallback(async (p) => {
    const snapshotLiked = Boolean(p.liked);
    const snapshotCount = Number(p.likeCount || 0);
    const nextLiked = !snapshotLiked;
    setPost((prev) =>
      prev && prev.id === p.id
        ? {
            ...prev,
            liked: nextLiked,
            likeCount: Math.max(0, snapshotCount + (nextLiked ? 1 : -1)),
          }
        : prev
    );
    try {
      const res = await fetch(`/api/community/posts/${p.id}/like`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed");
      const liked = Boolean(data.liked);
      setPost((prev) =>
        prev && prev.id === p.id
          ? {
              ...prev,
              liked,
              likeCount: typeof data.likeCount === "number" ? data.likeCount : prev.likeCount,
            }
          : prev
      );
      dispatchCommunityMutate({ reason: "like" });
    } catch {
      setPost((prev) =>
        prev && prev.id === p.id ? { ...prev, liked: snapshotLiked, likeCount: snapshotCount } : prev
      );
    }
  }, []);

  const bumpCommentCount = useCallback((postIdArg, delta) => {
    if (postIdArg !== postId) return;
    setPost((prev) =>
      prev ? { ...prev, commentCount: Math.max(0, (prev.commentCount || 0) + delta) } : prev
    );
  }, [postId]);

  const applyShareCount = useCallback((id, nextCount) => {
    setPost((prev) => (prev && prev.id === id ? { ...prev, share_count: nextCount } : prev));
    dispatchCommunityMutate({ reason: "share" });
  }, []);

  if (loading && !post) {
    return (
      <div className={`flex min-h-[40vh] items-center justify-center gap-2 ${isX ? "text-zinc-500" : "text-zinc-600 dark:text-zinc-400"}`}>
        <Loader2 className="h-8 w-8 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="space-y-4 px-3 py-6 md:px-4">
        <BackButton href={backHref} />
        <p className={`text-sm ${isX ? "text-zinc-600 dark:text-zinc-400" : "text-rose-600 dark:text-rose-400"}`}>{error || "Post not found."}</p>
      </div>
    );
  }

  return (
    <div className={`mx-auto w-full min-w-0 max-w-xl space-y-4 ${isX ? "px-3 py-4 text-[15px] md:px-4 md:py-6" : "px-4 py-6 sm:px-5"}`}>
      <div className="flex items-center gap-3">
        <BackButton href={backHref} />
        <h1 className={`text-lg font-bold ${isX ? "text-zinc-900 dark:text-white" : "text-zinc-900 dark:text-white"}`}>Post</h1>
      </div>

      <PostCard
        post={post}
        mode="detail"
        currentUserId={viewerUserId}
        onLikeToggle={onLikeToggle}
        onRequestShare={setShareTarget}
        onCommentCountChange={bumpCommentCount}
        onCommunityMutate={dispatchCommunityMutate}
        canInteract={canInteract}
        loginNextPath={loginNextPath}
        onNotifyError={(msg) => setError(String(msg || ""))}
        skin={skin}
        postDetailHref=""
        onPostRemoved={() => {
          router.push(backHref);
        }}
        onPostUpdated={(_, nextPost) => {
          setPost((prev) => (prev ? { ...prev, ...nextPost } : prev));
        }}
      />

      {shareTarget ? (
        <SharePostModal
          post={shareTarget}
          onClose={() => setShareTarget(null)}
          onShared={(nextCount) => applyShareCount(shareTarget.id, nextCount)}
        />
      ) : null}
    </div>
  );
}
