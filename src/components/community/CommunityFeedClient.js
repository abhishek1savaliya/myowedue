"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import CommunityLikesPrivateBanner from "@/components/community/CommunityLikesPrivateBanner";
import SharePostModal from "@/components/community/SharePostModal";
import { useUserStore } from "@/stores/useUserStore";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { BadgeCheck, ChevronRight, Heart, Loader2, MessageCircle, Pencil, RefreshCw, Repeat2, Send, Trash2 } from "lucide-react";
import {
  COMMUNITY_POST_EDIT_WINDOW_MS,
  formatCommunityPostEditedLabel,
  isCommunityPostEditWindowOpen,
  wasCommunityPostEdited,
} from "@/lib/community-post-edit-window";
import { COMMUNITY_MUTATE_EVENT, dispatchCommunityMutate, isCommunityEngagementMutate } from "@/lib/community-mutate-event";
import { isOnline } from "@/lib/offline/network";
import {
  buildOptimisticCommunityComment,
  buildOptimisticCommunityPost,
  getPendingCommunityPosts,
  isQueuedOfflineResponse,
  mergePostsWithPending,
} from "@/lib/offline/community-pending";
import { normalizeSavedUsernameHandle } from "@/lib/community-usernames";
import { normalizeCommunityTopicParam } from "@/lib/community-topic";
import { cn } from "@/lib/utils";
import {
  COMMUNITY_BTN_SECONDARY,
  COMMUNITY_FEED_HEADER_SUB,
  COMMUNITY_FEED_HEADER_TITLE,
  COMMUNITY_GLASS_CARD,
  COMMUNITY_FEED_SHELL,
} from "@/lib/community-ui";

const COMMUNITY_SETUP_MESSAGE =
  "Posts use Neon Postgres (SQL); the rest of the app uses MongoDB. Add NEON_DATABASE_URL to .env.local, or run supabase/migrations/001_community.sql through 011 on your Neon database.";

function isMissingCommunityTables(message) {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("schema cache") ||
    m.includes("community_posts") ||
    m.includes("community_post_shares") ||
    m.includes("community_comment_likes") ||
    m.includes("community_usernames") ||
    m.includes("community tables") ||
    m.includes("001_community") ||
    m.includes("post_topics") ||
    m.includes("supabase → sql") ||
    (m.includes("relation") && m.includes("does not exist")) ||
    m.includes("pgrst204") ||
    m.includes("pgrst205")
  );
}

function formatCommunityError(message) {
  if (isMissingCommunityTables(message)) return COMMUNITY_SETUP_MESSAGE;
  return String(message || "Something went wrong.");
}

function communityUserProfileHref(username) {
  const s = normalizeSavedUsernameHandle(String(username || ""));
  if (!s) return null;
  return `/community/user/${encodeURIComponent(s)}`;
}

function CommunityAuthorAttribution({ displayName, username, isSelf, verified, isX, className }) {
  const href = communityUserProfileHref(username);
  /** Public community feed uses dark glass cards — pale text on "x" skin. */
  const nameLink = isX
    ? "font-semibold text-zinc-100 underline-offset-2 hover:text-white hover:underline"
    : "font-semibold text-zinc-950 underline-offset-2 hover:text-zinc-800 hover:underline dark:text-zinc-50 dark:hover:text-zinc-200";
  const nameText = isX
    ? "font-semibold text-zinc-100"
    : "font-semibold text-zinc-950 dark:text-zinc-50";
  const handleLink = isX
    ? "font-normal text-zinc-400 underline-offset-2 hover:text-zinc-300 hover:underline"
    : "font-normal text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-300";
  const handleText = isX
    ? "font-normal text-zinc-400"
    : "font-normal text-zinc-700 dark:text-zinc-400";
  const youMuted = isX ? "text-sky-400" : "text-zinc-600 dark:text-zinc-400";

  return (
    <p className={className}>
      {href ? (
        <Link href={href} className={nameLink} onClick={(e) => e.stopPropagation()}>
          {displayName}
        </Link>
      ) : (
        <span className={nameText}>{displayName}</span>
      )}
      {username ? (
        <>
          {" "}
          {href ? (
            <Link href={href} className={handleLink} onClick={(e) => e.stopPropagation()}>
              @{username}
            </Link>
          ) : (
            <span className={handleText}>@{username}</span>
          )}
        </>
      ) : null}
      {verified ? (
        <BadgeCheck className="ml-1 inline h-4 w-4 shrink-0 align-text-bottom text-sky-500" aria-label="Verified" />
      ) : null}
      {isSelf ? <span className={`font-normal ${youMuted}`}> (you)</span> : null}
    </p>
  );
}

function insertReplyInTree(nodes, parentId, reply) {
  if (!Array.isArray(nodes)) return nodes;
  return nodes.map((node) => {
    if (String(node.id) === String(parentId)) {
      return { ...node, replies: [...(node.replies || []), reply] };
    }
    if (node.replies?.length) {
      return { ...node, replies: insertReplyInTree(node.replies, parentId, reply) };
    }
    return node;
  });
}

function CommentBranch({
  node,
  postId,
  depth,
  onRefresh,
  onOptimisticReply,
  currentUserId,
  canInteract,
  loginNextPath,
  onNotifyError,
  skin = "default",
  onSharePost,
}) {
  const router = useRouter();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [commentLiked, setCommentLiked] = useState(Boolean(node.commentLiked));
  const [commentLikeCount, setCommentLikeCount] = useState(Number(node.commentLikeCount ?? 0));
  const [likeBusy, setLikeBusy] = useState(false);

  useEffect(() => {
    setCommentLiked(Boolean(node.commentLiked));
    setCommentLikeCount(Number(node.commentLikeCount ?? 0));
  }, [node.id, node.commentLiked, node.commentLikeCount]);

  function goLogin() {
    router.push(`/login?next=${encodeURIComponent(loginNextPath)}`);
  }

  async function toggleCommentLike() {
    if (!canInteract) {
      goLogin();
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);
    const prevLiked = commentLiked;
    const prevCount = commentLikeCount;
    setCommentLiked(!prevLiked);
    setCommentLikeCount(Math.max(0, prevCount + (prevLiked ? -1 : 1)));
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments/${node.id}/like`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed");
      if (typeof data.commentLikeCount === "number") setCommentLikeCount(data.commentLikeCount);
      if (typeof data.liked === "boolean") setCommentLiked(data.liked);
    } catch (err) {
      setCommentLiked(prevLiked);
      setCommentLikeCount(prevCount);
      onNotifyError?.(err.message || "Failed to update like");
    } finally {
      setLikeBusy(false);
    }
  }

  async function submitReply(e) {
    e.preventDefault();
    if (!canInteract) {
      goLogin();
      return;
    }
    const t = replyText.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: t, parentId: node.id, parent_id: node.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to reply");
      setReplyText("");
      setReplyOpen(false);
      if (isQueuedOfflineResponse(data)) {
        const user = useUserStore.getState().user;
        const optimistic = buildOptimisticCommunityComment({
          postId,
          body: t,
          user,
          parentId: node.id,
        });
        onOptimisticReply?.(optimistic);
        onNotifyError?.(data.message || "Reply saved offline. It will sync when you're back online.");
      } else {
        onRefresh();
      }
    } catch (err) {
      onNotifyError?.(err.message || "Failed to reply");
    } finally {
      setSending(false);
    }
  }

  const maxDepth = 6;
  const pad = Math.min(depth, maxDepth);
  const isX = skin === "x";

  return (
    <div
      className={
        pad > 0
          ? isX
            ? "ml-3 border-l border-zinc-800 pl-3"
            : "ml-3 border-l border-zinc-200 pl-3 dark:border-zinc-700"
          : ""
      }
    >
      <div
        className={
          isX
            ? "rounded-lg border border-zinc-800 bg-zinc-950/80 py-2 pl-2 pr-2"
            : "rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/60"
        }
      >
        <CommunityAuthorAttribution
          displayName={node.author_name}
          username={node.author_username}
          isSelf={node.author_id === currentUserId}
          verified={Boolean(node.authorVerified)}
          isX={isX}
          className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
        />
        <p className={`mt-1 whitespace-pre-wrap text-sm ${isX ? "text-zinc-200" : "text-zinc-700 dark:text-zinc-300"}`}>{node.body}</p>
        <p className={`mt-1 text-[11px] ${isX ? "text-zinc-500" : "text-zinc-500"}`}>
          {formatDistanceToNow(new Date(node.created_at), { addSuffix: true })}
        </p>
        <div className={`mt-2 flex flex-wrap items-center gap-2 ${isX ? "" : ""}`}>
          <button
            type="button"
            onClick={() => void toggleCommentLike()}
            disabled={likeBusy}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold transition disabled:opacity-50 ${
              commentLiked
                ? isX
                  ? "bg-rose-950/50 text-rose-300"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                : isX
                  ? "text-zinc-400 hover:bg-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/80"
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${commentLiked ? "fill-current" : ""}`} strokeWidth={2} />
            {commentLikeCount}
          </button>
          {onSharePost ? (
            <button
              type="button"
              onClick={() => onSharePost()}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/80 ${
                isX ? "text-zinc-400 hover:bg-zinc-900" : ""
              }`}
            >
              <Repeat2 className="h-3.5 w-3.5" strokeWidth={2} />
              Share
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (!canInteract) {
                goLogin();
                return;
              }
              setReplyOpen((v) => !v);
            }}
            className={`text-xs font-semibold ${isX ? "text-sky-500 hover:underline" : "text-zinc-700 hover:underline dark:text-zinc-300"}`}
          >
            {!canInteract ? "Sign in to reply" : replyOpen ? "Cancel" : "Reply"}
          </button>
        </div>
        {replyOpen && canInteract ? (
          <form onSubmit={submitReply} className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              maxLength={500}
              placeholder="Write a reply…"
              className={
                isX
                  ? "min-w-0 flex-1 rounded-full border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                  : "min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              }
            />
            <button
              type="submit"
              disabled={sending || !replyText.trim()}
              className={
                isX
                  ? "inline-flex items-center justify-center gap-1 rounded-full bg-sky-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                  : "inline-flex items-center justify-center gap-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              }
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Reply
            </button>
          </form>
        ) : null}
      </div>
      {(node.replies || []).length > 0 ? (
        <div className="mt-2 space-y-2">
          {(node.replies || []).map((ch) => (
            <CommentBranch
              key={ch.id}
              node={ch}
              postId={postId}
              depth={depth + 1}
              onRefresh={onRefresh}
              onOptimisticReply={onOptimisticReply}
              currentUserId={currentUserId}
              canInteract={canInteract}
              loginNextPath={loginNextPath}
              onNotifyError={onNotifyError}
              skin={skin}
              onSharePost={onSharePost}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PostCard({
  post,
  currentUserId,
  onLikeToggle,
  onRequestShare,
  onCommentCountChange,
  onCommunityMutate,
  canInteract,
  loginNextPath,
  onNotifyError,
  skin = "default",
  postDetailHref = "",
  mode = "card",
  onPostRemoved,
  onPostUpdated,
}) {
  const router = useRouter();
  const viewerIsPremium = Boolean(useUserStore((s) => s.user?.isPremium));
  const isX = skin === "x";
  const isDetail = mode === "detail";
  const [commentsOpen, setCommentsOpen] = useState(isDetail);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [nextCommentCursor, setNextCommentCursor] = useState(null);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const nextCommentCursorRef = useRef(null);
  const loadMoreCommentsSentinelRef = useRef(null);
  const loadingMoreCommentsRef = useRef(false);

  function goLogin() {
    router.push(`/login?next=${encodeURIComponent(loginNextPath)}`);
  }

  const handleOptimisticComment = useCallback(
    (comment) => {
      const parentId = comment.parentId || comment.parent_id;
      setComments((prev) =>
        parentId ? insertReplyInTree(prev, parentId, comment) : [...prev, comment]
      );
      onCommentCountChange?.(post.id, 1);
    },
    [post.id, onCommentCountChange]
  );

  const isOwnPost = Boolean(
    canInteract && currentUserId && String(post.author_id) === String(currentUserId)
  );
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(post.body);
  const [savingPost, setSavingPost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editWindowClosed, setEditWindowClosed] = useState(
    () => !isCommunityPostEditWindowOpen(post.created_at)
  );
  const canEditPost = viewerIsPremium && isOwnPost && !editWindowClosed;

  useEffect(() => {
    if (!editing) setEditDraft(post.body);
  }, [post.body, post.id, editing]);

  useEffect(() => {
    if (!isOwnPost) return undefined;
    if (!isCommunityPostEditWindowOpen(post.created_at)) {
      setEditWindowClosed(true);
      return undefined;
    }
    setEditWindowClosed(false);
    const createdMs = new Date(post.created_at).getTime();
    const msLeft = COMMUNITY_POST_EDIT_WINDOW_MS - (Date.now() - createdMs);
    if (msLeft <= 0) {
      setEditWindowClosed(true);
      return undefined;
    }
    const timer = setTimeout(() => {
      setEditWindowClosed(true);
      setEditing(false);
    }, msLeft);
    return () => clearTimeout(timer);
  }, [isOwnPost, post.created_at]);

  useEffect(() => {
    if (editWindowClosed && editing) {
      setEditing(false);
      setEditDraft(post.body);
    }
  }, [editWindowClosed, editing, post.body]);

  const startEdit = useCallback(() => {
    if (!canInteract || !canEditPost) return;
    setEditDraft(post.body);
    setEditing(true);
  }, [canInteract, canEditPost, post.body]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditDraft(post.body);
  }, [post.body]);

  const saveEdit = useCallback(async () => {
    const t = editDraft.trim();
    if (!t || savingPost) return;
    setSavingPost(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: t }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to update post");
      if (data.post) onPostUpdated?.(post.id, data.post);
      setEditing(false);
      onCommunityMutate?.();
    } catch (err) {
      onNotifyError?.(err.message || "Failed to update post");
    } finally {
      setSavingPost(false);
    }
  }, [editDraft, post.id, savingPost, onPostUpdated, onCommunityMutate, onNotifyError]);

  const openDeleteModal = useCallback(() => {
    if (!canInteract || !isOwnPost || editing || deletingPost) return;
    setDeleteModalOpen(true);
  }, [canInteract, isOwnPost, editing, deletingPost]);

  const cancelDeleteModal = useCallback(() => {
    if (deletingPost) return;
    setDeleteModalOpen(false);
  }, [deletingPost]);

  const confirmDeletePost = useCallback(async () => {
    if (!canInteract || !isOwnPost || deletingPost) return;
    setDeletingPost(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to delete post");
      setDeleteModalOpen(false);
      onPostRemoved?.(post.id);
      onCommunityMutate?.();
    } catch (err) {
      onNotifyError?.(err.message || "Failed to delete post");
    } finally {
      setDeletingPost(false);
    }
  }, [canInteract, isOwnPost, deletingPost, post.id, onPostRemoved, onCommunityMutate, onNotifyError]);

  useEffect(() => {
    if (!deleteModalOpen) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") cancelDeleteModal();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteModalOpen, cancelDeleteModal]);

  useEffect(() => {
    nextCommentCursorRef.current = nextCommentCursor;
  }, [nextCommentCursor]);

  const loadComments = useCallback(
    async (append = false) => {
      if (isDetail) {
        if (append) {
          if (!nextCommentCursorRef.current || loadingMoreCommentsRef.current) return;
          loadingMoreCommentsRef.current = true;
          setLoadingMoreComments(true);
        } else {
          setLoadingComments(true);
        }
        try {
          const c = nextCommentCursorRef.current;
          const qs = new URLSearchParams({ limit: "5" });
          if (append && c) qs.set("cursor", c);
          const res = await fetch(`/api/community/posts/${post.id}/comments?${qs.toString()}`, {
            credentials: "include",
            cache: "no-store",
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.message || "Failed to load comments");
          const next = data.comments || [];
          setComments((prev) => (append ? [...prev, ...next] : next));
          setNextCommentCursor(data.nextCommentCursor || null);
          setHasMoreComments(Boolean(data.hasMoreComments));
        } catch (e) {
          console.error(e);
        } finally {
          if (append) {
            loadingMoreCommentsRef.current = false;
            setLoadingMoreComments(false);
          } else {
            setLoadingComments(false);
          }
        }
        return;
      }

      setLoadingComments(true);
      try {
        const res = await fetch(`/api/community/posts/${post.id}/comments`, { credentials: "include", cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Failed to load comments");
        setComments(data.comments || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingComments(false);
      }
    },
    [post.id, isDetail]
  );

  useEffect(() => {
    if (!isDetail) return undefined;
    void loadComments(false);
    return undefined;
  }, [isDetail, post.id, loadComments]);

  useEffect(() => {
    if (!isDetail) return undefined;
    const el = loadMoreCommentsSentinelRef.current;
    if (!el) return undefined;
    const ob = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (
            entry.isIntersecting &&
            hasMoreComments &&
            nextCommentCursorRef.current &&
            !loadingMoreCommentsRef.current &&
            !loadingComments
          ) {
            void loadComments(true);
          }
        }
      },
      { root: null, rootMargin: "120px", threshold: 0 }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [isDetail, hasMoreComments, loadingComments, loadComments, comments.length]);

  async function submitTopComment(e) {
    e.preventDefault();
    if (!canInteract) {
      goLogin();
      return;
    }
    const t = commentText.trim();
    if (!t || postingComment) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: t }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to comment");
      setCommentText("");
      if (isQueuedOfflineResponse(data)) {
        const user = useUserStore.getState().user;
        handleOptimisticComment(
          buildOptimisticCommunityComment({
            postId: post.id,
            body: t,
            user,
          })
        );
        onNotifyError?.(data.message || "Comment saved offline. It will sync when you're back online.");
      } else {
        await loadComments(isDetail ? false : undefined);
        onCommentCountChange(post.id, 1);
      }
    } catch (err) {
      onNotifyError?.(err.message || "Failed to comment");
    } finally {
      setPostingComment(false);
    }
  }

  function renderAuthorHeader() {
    return (
      <div className="flex items-start justify-between gap-3">
        <div>
          <CommunityAuthorAttribution
            displayName={post.author_name}
            username={post.author_username}
            isSelf={post.author_id === currentUserId}
            verified={post.authorVerified}
            isX={isX}
            className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm"
          />
          <p className={`text-xs ${isX ? "text-zinc-500" : "text-zinc-500 dark:text-zinc-400"}`}>
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            {wasCommunityPostEdited(post.created_at, post.updated_at) ? (
              <span className={isX ? "text-zinc-400" : "text-zinc-400 dark:text-zinc-500"}>
                {" "}
                · {formatCommunityPostEditedLabel(post.updated_at)}
              </span>
            ) : null}
          </p>
        </div>
      </div>
    );
  }

  function renderReadonlyPostBlock(forX) {
    const linkClass = forX
      ? "-m-1 block rounded-xl p-1 outline-offset-2 hover:bg-white/5"
      : "-m-1 block rounded-xl p-1 outline-offset-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50";
    const bodyClass = forX
      ? "mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-200"
      : "mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200";
    if (postDetailHref) {
      return (
        <>
          {renderAuthorHeader()}
          <Link href={postDetailHref} className={linkClass}>
            <p className={bodyClass}>{post.body}</p>
          </Link>
        </>
      );
    }
    return (
      <>
        {renderAuthorHeader()}
        <p className={bodyClass}>{post.body}</p>
      </>
    );
  }

  function renderEditingBlock(forX) {
    const taClass = forX
      ? "mt-3 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[15px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
      : "mt-3 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[15px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500";
    const saveClass = forX
      ? "inline-flex items-center justify-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      : "inline-flex items-center justify-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
    const cancelClass = forX
      ? "inline-flex items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      : "inline-flex items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200";
    return (
      <>
        {renderAuthorHeader()}
        <textarea
          value={editDraft}
          onChange={(e) => setEditDraft(e.target.value)}
          maxLength={280}
          rows={4}
          aria-label="Edit post"
          className={taClass}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">{editDraft.length}/280</span>
          <button type="button" disabled={savingPost || !editDraft.trim()} onClick={() => void saveEdit()} className={saveClass}>
            {savingPost ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Save
          </button>
          <button type="button" disabled={savingPost} onClick={cancelEdit} className={cancelClass}>
            Cancel
          </button>
        </div>
      </>
    );
  }

  function renderOwnerControls(forX) {
    if (!isOwnPost || editing) return null;
    const iconBtn = forX
      ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";
    const delBtn = forX
      ? `${iconBtn} border-rose-200/90 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/40`
      : `${iconBtn} border-rose-200/90 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/40`;
    return (
      <div className="flex shrink-0 items-center justify-end gap-1.5" role="group" aria-label="Your post">
        {canEditPost ? (
          <button type="button" onClick={startEdit} className={iconBtn} aria-label="Edit post" title="Edit post (Pro)">
            <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          onClick={openDeleteModal}
          disabled={deletingPost}
          className={delBtn}
          aria-label="Delete post"
          title="Delete post"
        >
          {deletingPost ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />}
        </button>
      </div>
    );
  }

  function renderDeleteModal() {
    if (!deleteModalOpen || typeof document === "undefined") return null;
    const panel = isX
      ? "rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      : "rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900";
    const cancelBtn = isX
      ? "inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      : "inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";
    const deleteBtn =
      "inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60 dark:bg-rose-600 dark:hover:bg-rose-500";

    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 p-4 backdrop-blur-sm sm:items-center sm:p-6"
        role="presentation"
        onClick={cancelDeleteModal}
      >
        <div
          className={`w-full max-w-sm ${panel} overflow-hidden`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-post-dialog-title"
          onClick={(e) => e.stopPropagation()}
        >
          {isX ? (
            <div className="h-1 w-full bg-linear-to-r from-zinc-300 via-zinc-400 to-zinc-300 dark:from-zinc-600 dark:via-zinc-500 dark:to-zinc-600" aria-hidden />
          ) : (
            <div className="h-1 w-full bg-zinc-400 dark:bg-zinc-600" aria-hidden />
          )}
          <div className="p-5 sm:p-6">
            <h2 id="delete-post-dialog-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Delete this post?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              This cannot be undone. Comments and likes on this post will be removed.
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" className={cancelBtn} onClick={cancelDeleteModal} disabled={deletingPost}>
                Cancel
              </button>
              <button
                type="button"
                className={deleteBtn}
                onClick={() => void confirmDeletePost()}
                disabled={deletingPost}
              >
                {deletingPost ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (isX) {
    return (
      <article className={`overflow-hidden ${COMMUNITY_GLASS_CARD}`}>
        <div className="h-1 w-full bg-linear-to-r from-amber-500/40 via-emerald-400/30 to-amber-500/40" aria-hidden />
        <div className="p-4 md:p-5">
          {editing ? renderEditingBlock(true) : renderReadonlyPostBlock(true)}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-y-2 border-t border-white/[0.08] pt-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (!canInteract) {
                    goLogin();
                    return;
                  }
                  onLikeToggle(post);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  post.liked
                    ? "bg-rose-500/20 text-rose-300"
                    : "text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
              >
                <Heart className={`h-4 w-4 ${post.liked ? "fill-current" : ""}`} strokeWidth={2} />
                {post.likeCount || 0}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isDetail) return;
                  setCommentsOpen((v) => {
                    const next = !v;
                    if (next) void loadComments();
                    return next;
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={2} />
                {post.commentCount || 0}
              </button>
              <button
                type="button"
                onClick={() => onRequestShare(post)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
              >
                <Repeat2 className="h-4 w-4" strokeWidth={2} />
                {post.share_count ?? 0}
              </button>
            </div>
            {renderOwnerControls(true)}
          </div>
          {commentsOpen || isDetail ? (
            <div className="mt-4 border-t border-white/[0.08] pt-4">
              {canInteract ? (
                <form onSubmit={submitTopComment} className="mb-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    maxLength={500}
                    placeholder="Add a comment…"
                    className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <button
                    type="submit"
                    disabled={postingComment || !commentText.trim()}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    {postingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Comment
                  </button>
                </form>
              ) : (
                <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                  <button type="button" onClick={goLogin} className="font-semibold text-zinc-800 underline decoration-zinc-400 hover:text-zinc-950 dark:text-zinc-200 dark:decoration-zinc-500">
                    Sign in
                  </button>{" "}
                  to join the conversation.
                </p>
              )}
              {loadingComments ? (
                <p className="text-sm text-zinc-500">Loading comments…</p>
              ) : (
                <div className="space-y-3">
                  {comments.map((c) => (
                    <CommentBranch
                      key={c.id}
                      node={c}
                      postId={post.id}
                      depth={0}
                      onRefresh={() => {
                        void loadComments(isDetail ? false : undefined);
                        onCommentCountChange(post.id, 1);
                      }}
                      onOptimisticReply={handleOptimisticComment}
                      currentUserId={currentUserId}
                      canInteract={canInteract}
                      loginNextPath={loginNextPath}
                      onNotifyError={onNotifyError}
                      skin="default"
                      onSharePost={() => onRequestShare(post)}
                    />
                  ))}
                  {comments.length === 0 && !loadingComments ? <p className="text-sm text-zinc-500">No comments yet.</p> : null}
                  {isDetail ? (
                    <>
                      <div ref={loadMoreCommentsSentinelRef} className="h-2 w-full shrink-0" aria-hidden />
                      {loadingMoreComments ? (
                        <p className="flex items-center gap-2 py-2 text-sm text-zinc-500">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Loading more…
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
        {renderDeleteModal()}
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80 md:p-5">
      {editing ? renderEditingBlock(false) : renderReadonlyPostBlock(false)}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (!canInteract) {
                goLogin();
                return;
              }
              onLikeToggle(post);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              post.liked
                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/80"
            }`}
          >
            <Heart className={`h-4 w-4 ${post.liked ? "fill-current" : ""}`} strokeWidth={2} />
            {post.likeCount || 0}
          </button>
          <button
            type="button"
            onClick={() => {
              if (isDetail) return;
              setCommentsOpen((v) => {
                const next = !v;
                if (next) void loadComments();
                return next;
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/80"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2} />
            {post.commentCount || 0}
          </button>
          <button
            type="button"
            onClick={() => onRequestShare(post)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/80"
          >
            <Repeat2 className="h-4 w-4" strokeWidth={2} />
            {post.share_count ?? 0}
          </button>
        </div>
        {renderOwnerControls(false)}
      </div>
      {commentsOpen || isDetail ? (
        <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          {canInteract ? (
            <form onSubmit={submitTopComment} className="mb-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                maxLength={500}
                placeholder="Add a comment…"
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <button
                type="submit"
                disabled={postingComment || !commentText.trim()}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {postingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Comment
              </button>
            </form>
          ) : (
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              <button type="button" onClick={goLogin} className="font-semibold text-zinc-800 underline decoration-zinc-400 hover:text-zinc-950 dark:text-zinc-200 dark:decoration-zinc-500">
                Sign in
              </button>{" "}
              to join the conversation.
            </p>
          )}
          {loadingComments ? (
            <p className="text-sm text-zinc-500">Loading comments…</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <CommentBranch
                  key={c.id}
                  node={c}
                  postId={post.id}
                  depth={0}
                  onRefresh={() => {
                    void loadComments(isDetail ? false : undefined);
                    onCommentCountChange(post.id, 1);
                  }}
                  onOptimisticReply={handleOptimisticComment}
                  currentUserId={currentUserId}
                  canInteract={canInteract}
                  loginNextPath={loginNextPath}
                  onNotifyError={onNotifyError}
                  skin="default"
                  onSharePost={() => onRequestShare(post)}
                />
              ))}
              {comments.length === 0 && !loadingComments ? <p className="text-sm text-zinc-500">No comments yet.</p> : null}
              {isDetail ? (
                <>
                  <div ref={loadMoreCommentsSentinelRef} className="h-2 w-full shrink-0" aria-hidden />
                  {loadingMoreComments ? (
                    <p className="flex items-center gap-2 py-2 text-sm text-zinc-500">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Loading more…
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      {renderDeleteModal()}
    </article>
  );
}

/** Tabs for /posts (portal) only; public /community shows a single feed. */
const FEED_TABS_PORTAL = [
  { id: "all", label: "My posts" },
  { id: "liked", label: "Liked" },
  { id: "shared", label: "Shared" },
];

/** Portal home tab lists only the signed-in user’s posts (`filter=mine`). Community lists everyone. */
function buildPostsQuery(tab, cursor, portalMineHome, topic) {
  const p = new URLSearchParams();
  if (portalMineHome && tab === "all") p.set("filter", "mine");
  else if (tab && tab !== "all") p.set("filter", tab);
  if (cursor) p.set("cursor", cursor);
  if (topic && tab === "all" && !portalMineHome) p.set("topic", topic);
  const qs = p.toString();
  return qs ? `/api/community/posts?${qs}` : "/api/community/posts";
}

function normalizeInitialFeedPost(p) {
  if (!p || typeof p !== "object") return null;
  return {
    ...p,
    share_count: p.share_count ?? 0,
    likeCount: p.likeCount ?? 0,
    commentCount: p.commentCount ?? 0,
    liked: Boolean(p.liked),
    authorVerified: Boolean(p.authorVerified),
  };
}

/** Keep first occurrence per id (stable order) to avoid duplicate React keys. */
function dedupePostsById(posts) {
  if (!Array.isArray(posts)) return [];
  const seen = new Set();
  const out = [];
  for (const post of posts) {
    const id = post?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(post);
  }
  return out;
}

/**
 * @param {{ variant?: "portal" | "public"; shareBasePath?: string; loginNextPath?: string; skin?: "default" | "x"; containerClassName?: string; initialFeedPosts?: Array<object> | null; initialUser?: object | null }} props
 */
export default function CommunityFeedClient({
  variant = "portal",
  shareBasePath = "/community",
  loginNextPath = "/community",
  skin = "default",
  containerClassName = "",
  initialFeedPosts = null,
  initialUser = null,
}) {
  const isPortal = variant === "portal";
  const router = useRouter();
  const searchParams = useSearchParams();
  const topicFilterRaw = isPortal ? "" : String(searchParams.get("topic") || "");
  const topicFilter = useMemo(
    () => (isPortal ? "" : normalizeCommunityTopicParam(topicFilterRaw)),
    [isPortal, topicFilterRaw]
  );

  const seedList = useMemo(() => {
    if (isPortal || !Array.isArray(initialFeedPosts) || initialFeedPosts.length === 0) return [];
    return dedupePostsById(initialFeedPosts.map(normalizeInitialFeedPost).filter(Boolean));
  }, [isPortal, initialFeedPosts]);

  const [posts, setPosts] = useState(() => seedList);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(() => seedList.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState(() => {
    if (isPortal) return "";
    return initialUser?.id || useUserStore.getState().user?.id || "";
  });
  const [authResolved, setAuthResolved] = useState(() => {
    if (isPortal) return true;
    if (initialUser) return true;
    const { status } = useUserStore.getState();
    return status === "ready" || status === "error";
  });
  const [composer, setComposer] = useState("");
  const [posting, setPosting] = useState(false);
  const [configError, setConfigError] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState("");
  const [feedTab, setFeedTab] = useState("all");
  const [shareTarget, setShareTarget] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const skipNextCommunityMutateRef = useRef(false);

  const isX = !isPortal && skin === "x";
  const portalMineHome = isPortal;
  const sessionUserId = useUserStore((s) => s.user?.id || "");
  /** Feed API can omit currentUserId on seeded/cached responses; trust session when signed in. */
  const viewerUserId = currentUserId || sessionUserId;
  const canInteract = Boolean(viewerUserId);
  const viewerIsPremium = Boolean(useUserStore((s) => s.user?.isPremium));

  useEffect(() => {
    if (!isPortal && sessionUserId && !authResolved) {
      setCurrentUserId(sessionUserId);
      setAuthResolved(true);
    }
  }, [isPortal, sessionUserId, authResolved]);
  const feedPosts = useMemo(() => dedupePostsById(posts), [posts]);

  const nextCursorRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const loadMoreSentinelRef = useRef(null);
  /** After first successful feed GET, tab switches use inline loading instead of a full-page spinner. */
  const feedHydratedRef = useRef(false);
  const loadingRef = useRef(false);
  /** Bumped on each feed reset so stale loadMore responses cannot append. */
  const feedEpochRef = useRef(0);

  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const reportActionError = useCallback((rawMessage) => {
    const formatted = formatCommunityError(rawMessage);
    setError(formatted);
    if (isMissingCommunityTables(rawMessage)) setConfigError(true);
  }, []);

  const mergePendingIntoPosts = useCallback(async () => {
    const user = useUserStore.getState().user;
    const pending = await getPendingCommunityPosts(user);
    setPosts((prev) => mergePostsWithPending(prev, pending));
  }, []);

  /** Paint red hearts from the viewer's liked-ids — survives SEO seed + stale Redis. */
  const hydrateMyLikedFlags = useCallback(async (isCancelled = () => false) => {
    if (!isOnline()) return;
    try {
      const res = await fetch("/api/community/me/liked-ids", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || isCancelled()) return;
      if (data.currentUserId) setCurrentUserId(String(data.currentUserId));
      const likedSet = new Set((Array.isArray(data.ids) ? data.ids : []).map(String));
      // Guest / no session → empty ids; still clear any stale liked flags from optimistic UI.
      setPosts((prev) => {
        let changed = false;
        const next = prev.map((p) => {
          const id = String(p?.id || "");
          if (!id) return p;
          const liked = likedSet.has(id);
          const wasLiked = Boolean(p.liked);
          if (liked === wasLiked) return p;
          changed = true;
          let likeCount = Number(p.likeCount || 0);
          if (liked && !wasLiked) likeCount += 1;
          if (!liked && wasLiked) likeCount = Math.max(0, likeCount - 1);
          return { ...p, liked, likeCount };
        });
        return changed ? next : prev;
      });
    } catch {
      /* non-critical */
    }
  }, []);

  /** Refetch when session appears — public feed likes are viewer-specific (private hearts). */
  const tabAuthKey = useMemo(() => {
    if (feedTab === "liked" || feedTab === "shared") return viewerUserId || "__guest__";
    if (!isPortal) return `all:${sessionUserId || "__guest__"}`;
    return "__all__";
  }, [feedTab, viewerUserId, isPortal, sessionUserId]);

  const loadFeed = useCallback(
    async ({ force = false, isCancelled = () => false } = {}) => {
      const epoch = feedEpochRef.current + 1;
      feedEpochRef.current = epoch;

      const activeUserId = currentUserId || useUserStore.getState().user?.id || "";

      if ((feedTab === "liked" || feedTab === "shared") && !activeUserId) {
        setPosts([]);
        setNextCursor(null);
        nextCursorRef.current = null;
        setLoading(false);
        setError("");
        return;
      }

      const hasSeed = !force && !isPortal && feedTab === "all" && !topicFilter && seedList.length > 0;

      if (!isOnline()) {
        setLoading(true);
        setError("");
        const user = useUserStore.getState().user;
        const pending = await getPendingCommunityPosts(user);
        setPosts((prev) => {
          const base = prev.length > 0 ? prev : hasSeed ? seedList : [];
          return mergePostsWithPending(base, pending);
        });
        setCurrentUserId(user?.id || "");
        setLoading(false);
        setAuthResolved(true);
        return;
      }

      if (hasSeed && !force) {
        setLoading(false);
        setAuthResolved(true);
        feedHydratedRef.current = true;
        const res = await fetch(buildPostsQuery(feedTab, null, portalMineHome, topicFilter), {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (isCancelled() || epoch !== feedEpochRef.current) return;
        if (res.ok) {
          setPosts(dedupePostsById(data.posts || []));
          setNextCursor(data.nextCursor || null);
          nextCursorRef.current = data.nextCursor || null;
          setCurrentUserId(data.currentUserId || useUserStore.getState().user?.id || "");
          setConfigError(false);
        }
        // Always re-apply hearts from DB for the signed-in viewer (seed forces liked:false).
        if (epoch === feedEpochRef.current) {
          await hydrateMyLikedFlags(() => isCancelled() || epoch !== feedEpochRef.current);
        }
        return;
      }

      if (!hasSeed) {
        setLoading(true);
        setError("");
        setPosts([]);
        setNextCursor(null);
        nextCursorRef.current = null;
      } else {
        setError("");
      }
      try {
        const res = await fetch(buildPostsQuery(feedTab, null, portalMineHome, topicFilter), {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (isCancelled()) return;
        if (res.status === 503) {
          setConfigError(true);
          setError(data.message || "Community is not configured.");
          setAuthResolved(true);
          if (!hasSeed) setPosts([]);
          return;
        }
        if (!res.ok) {
          const msg = data.message || "Failed to load posts";
          if (isMissingCommunityTables(msg)) {
            setConfigError(true);
            setError(COMMUNITY_SETUP_MESSAGE);
            setAuthResolved(true);
            if (!hasSeed) setPosts([]);
            return;
          }
          if (hasSeed) {
            setAuthResolved(true);
            setCurrentUserId(useUserStore.getState().user?.id || "");
            setError(msg);
            await hydrateMyLikedFlags(() => isCancelled() || epoch !== feedEpochRef.current);
            return;
          }
          throw new Error(msg);
        }
        if (isCancelled() || epoch !== feedEpochRef.current) return;
        setConfigError(false);
        setPosts(dedupePostsById(data.posts || []));
        setNextCursor(data.nextCursor || null);
        setCurrentUserId(data.currentUserId || useUserStore.getState().user?.id || "");
        setAuthResolved(true);
        feedHydratedRef.current = true;
        await hydrateMyLikedFlags(() => isCancelled() || epoch !== feedEpochRef.current);
      } catch (e) {
        if (isCancelled()) return;
        const msg = e.message || "Failed to load";
        if (isMissingCommunityTables(msg)) {
          setConfigError(true);
          setError(COMMUNITY_SETUP_MESSAGE);
        } else {
          setError(msg);
        }
      } finally {
        if (!isCancelled()) {
          setLoading(false);
          setAuthResolved(true);
        }
      }
    },
    [feedTab, viewerUserId, isPortal, portalMineHome, seedList.length, topicFilter, hydrateMyLikedFlags]
  );

  useEffect(() => {
    let cancelled = false;
    void loadFeed({ force: false, isCancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [loadFeed, tabAuthKey]);

  useEffect(() => {
    if (!sessionUserId) return undefined;
    let cancelled = false;
    void hydrateMyLikedFlags(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [sessionUserId, hydrateMyLikedFlags]);

  useEffect(() => {
    const onQueueOrCommunitySync = (event) => {
      void mergePendingIntoPosts();
      if (isCommunityEngagementMutate(event?.detail)) return;
      if (skipNextCommunityMutateRef.current) {
        skipNextCommunityMutateRef.current = false;
        return;
      }
      if (isOnline()) void loadFeed({ force: true, isCancelled: () => false });
    };
    window.addEventListener("owedue-offline-queue-changed", onQueueOrCommunitySync);
    window.addEventListener(COMMUNITY_MUTATE_EVENT, onQueueOrCommunitySync);
    return () => {
      window.removeEventListener("owedue-offline-queue-changed", onQueueOrCommunitySync);
      window.removeEventListener(COMMUNITY_MUTATE_EVENT, onQueueOrCommunitySync);
    };
  }, [mergePendingIntoPosts, loadFeed]);

  const refreshFeed = useCallback(async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    setError("");
    try {
      await loadFeed({ force: true, isCancelled: () => false });
    } finally {
      setRefreshing(false);
    }
  }, [loadFeed, loading, refreshing]);

  const loadMore = useCallback(async () => {
    const cursor = nextCursorRef.current;
    if (!cursor || loadingMoreRef.current) return;
    const activeUserId = currentUserId || useUserStore.getState().user?.id || "";
    if ((feedTab === "liked" || feedTab === "shared") && !activeUserId) return;

    const epoch = feedEpochRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(buildPostsQuery(feedTab, cursor, portalMineHome, topicFilter), {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to load more");
      if (epoch !== feedEpochRef.current) return;
      setPosts((prev) => dedupePostsById([...prev, ...(data.posts || [])]));
      setNextCursor(data.nextCursor || null);
      setCurrentUserId(data.currentUserId || useUserStore.getState().user?.id || "");
    } catch (e) {
      reportActionError(e.message || "Failed to load more");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [feedTab, viewerUserId, reportActionError, portalMineHome, topicFilter]);

  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el) return undefined;

    const ob = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (
            entry.isIntersecting &&
            nextCursorRef.current &&
            !loadingMoreRef.current &&
            !loadingRef.current
          ) {
            void loadMore();
          }
        }
      },
      { root: null, rootMargin: "160px", threshold: 0 }
    );

    ob.observe(el);
    return () => ob.disconnect();
  }, [loadMore, posts.length, feedTab, topicFilter]);

  async function createPost(e) {
    e?.preventDefault?.();
    const t = composer.trim();
    if (!t || posting) return;
    setPosting(true);
    setError("");
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: t }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || "Failed to post";
        if (res.status === 401) {
          router.push(`/login?next=${encodeURIComponent(loginNextPath)}`);
          return;
        }
        if (res.status === 503) {
          setConfigError(true);
          setError(msg);
        } else {
          reportActionError(msg);
        }
        return;
      }
      setConfigError(false);
      setComposer("");
      if (isQueuedOfflineResponse(data)) {
        setOfflineNotice(data.message || "Post saved offline. It will sync when you're back online.");
        const user = useUserStore.getState().user;
        if (feedTab === "all") {
          const optimistic = buildOptimisticCommunityPost({ body: t, user });
          setPosts((prev) => dedupePostsById([optimistic, ...prev]));
        }
        skipNextCommunityMutateRef.current = true;
        dispatchCommunityMutate();
        return;
      }
      setOfflineNotice("");
      if (feedTab === "all") {
        if (topicFilter) {
          try {
            const refreshRes = await fetch(buildPostsQuery("all", null, portalMineHome, topicFilter), {
              credentials: "include",
              cache: "no-store",
            });
            const refreshData = await refreshRes.json().catch(() => ({}));
            if (refreshRes.ok) {
              setPosts(dedupePostsById(refreshData.posts || []));
              setNextCursor(refreshData.nextCursor || null);
            }
          } catch {
            /* ignore */
          }
        } else {
          setPosts((prev) => dedupePostsById([data.post, ...prev]));
        }
      }
      skipNextCommunityMutateRef.current = true;
      dispatchCommunityMutate();
    } catch (err) {
      reportActionError(err.message || "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  async function onLikeToggle(post) {
    const prevPosts = posts;
    const prev = posts.find((p) => p.id === post.id);
    const nextLiked = !Boolean(prev?.liked);
    // Optimistic: paint red heart immediately, then reconcile with server.
    if (feedTab === "liked" && !nextLiked) {
      setPosts((list) => list.filter((p) => p.id !== post.id));
    } else {
      setPosts((list) =>
        list.map((p) =>
          p.id === post.id
            ? { ...p, liked: nextLiked, likeCount: Math.max(0, (p.likeCount || 0) + (nextLiked ? 1 : -1)) }
            : p
        )
      );
    }
    try {
      const res = await fetch(`/api/community/posts/${post.id}/like`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPosts(prevPosts);
        const msg = data.message || "Failed";
        if (res.status === 503) {
          setConfigError(true);
          setError(msg);
        } else {
          throw new Error(msg);
        }
        return;
      }
      skipNextCommunityMutateRef.current = true;
      dispatchCommunityMutate({ reason: "like" });
      const liked = Boolean(data.liked);
      if (feedTab === "liked" && !liked) {
        setPosts((list) => list.filter((p) => p.id !== post.id));
      } else {
        setPosts((list) =>
          list.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  liked,
                  // Server may omit likeCount on the fast path — keep optimistic value.
                  likeCount: typeof data.likeCount === "number" ? data.likeCount : p.likeCount,
                }
              : p
          )
        );
      }
    } catch (e) {
      setPosts(prevPosts);
      reportActionError(e.message || "Failed");
    }
  }

  const applyShareCount = useCallback(
    (postId, nextCount, snapshotPost) => {
      setPosts((prev) => {
        const mapped = prev.map((p) => (p.id === postId ? { ...p, share_count: nextCount } : p));
        if (feedTab === "shared" && canInteract && snapshotPost && !mapped.some((p) => p.id === postId)) {
          return dedupePostsById([{ ...snapshotPost, share_count: nextCount }, ...mapped]);
        }
        return mapped;
      });
      skipNextCommunityMutateRef.current = true;
      dispatchCommunityMutate({ reason: "share" });
    },
    [feedTab, canInteract]
  );

  function bumpCommentCount(postId, delta) {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentCount: Math.max(0, (p.commentCount || 0) + delta) } : p))
    );
  }

  if (!authResolved && !isPortal && !sessionUserId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-zinc-600 dark:text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <span className="text-sm">Loading community…</span>
      </div>
    );
  }

  if (loading && !feedHydratedRef.current && !(isX && !isPortal)) {
    if (isX) {
      return (
        <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 text-zinc-500">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <span className="text-sm">Loading community…</span>
        </div>
      );
    }
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-zinc-600 dark:text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        {isPortal ? "Loading posts…" : "Loading community…"}
      </div>
    );
  }

  if (configError) {
    const setupIncluded =
      typeof error === "string" &&
      (error.includes("001_community.sql") ||
        error.includes("NEON_DATABASE_URL") ||
        error.includes("COMMUNITY_DATABASE_URL") ||
        error.includes("MongoDB"));
    return (
      <div
        className={
          isX
            ? "rounded-xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-50"
            : "rounded-xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-50"
        }
      >
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Community unavailable</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{error}</p>
        {!setupIncluded ? (
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Add <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">NEON_DATABASE_URL</code> to{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">.env.local</code>,
            or run migrations in <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">supabase/migrations/</code> on Neon.
          </p>
        ) : null}
      </div>
    );
  }

  const title = isPortal ? "Posts" : topicFilter ? `#${topicFilter}` : "Community";
  const subtitle = isPortal
    ? "This page shows only your posts. Open Community to read and join the full public feed."
    : topicFilter
      ? "Posts that match this trending topic, newest first. Open the full feed anytime from the link below."
      : canInteract
        ? "You're signed in — post, like, and comment on the public feed."
        : "Anyone can read and share posts. Sign in to publish, like, or comment.";

  const showComposer = authResolved && canInteract;

  const tabBar = (
    <div
      className={
        isX
          ? "flex gap-1 rounded-xl border border-zinc-200 bg-zinc-100/90 p-1 dark:border-zinc-700 dark:bg-zinc-800/80"
          : "flex gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-900/60"
      }
      role="tablist"
      aria-label="Feed filter"
    >
      {FEED_TABS_PORTAL.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={feedTab === t.id}
          onClick={() => setFeedTab(t.id)}
          className={`min-h-[44px] flex-1 rounded-xl px-2 text-center text-xs font-semibold transition sm:text-sm ${
            feedTab === t.id
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  const composeForm = showComposer ? (
    <form
      onSubmit={createPost}
      className={
        isX
          ? "rounded-xl border border-white/10 bg-slate-950/80 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.22)]"
          : "rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/80"
      }
    >
      <label className="sr-only" htmlFor="community-compose">
        What&apos;s happening?
      </label>
      <textarea
        id="community-compose"
        value={composer}
        onChange={(e) => setComposer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.shiftKey) return;
          e.preventDefault();
          if (posting || !composer.trim()) return;
          void createPost(e);
        }}
        maxLength={280}
        rows={3}
        placeholder="What’s happening?"
        className={
          isX
            ? "w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/40 focus:outline-none"
            : "w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
        }
      />
      {offlineNotice ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{offlineNotice}</p>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-500">{composer.length}/280</span>
        <button
          type="submit"
          disabled={posting || !composer.trim()}
          className={
            isX
              ? "inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50 hover:bg-amber-400"
              : "inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          }
        >
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Post
        </button>
      </div>
    </form>
  ) : null;

  const guestPromo =
    authResolved && !showComposer && !isPortal ? (
      <div
        className={
          isX
            ? "rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300"
            : "rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-200"
        }
      >
        <a
          href={`/login?next=${encodeURIComponent(loginNextPath)}`}
          className="font-semibold text-zinc-800 underline decoration-zinc-400 hover:text-zinc-950 dark:text-zinc-200 dark:decoration-zinc-500"
        >
          Sign in
        </a>{" "}
        or{" "}
        <a href="/signup" className="font-semibold text-zinc-800 underline decoration-zinc-400 hover:text-zinc-950 dark:text-zinc-200 dark:decoration-zinc-500">
          create an account
        </a>{" "}
        to publish, like, or comment. You can share posts without signing in.
      </div>
    ) : null;

  const likesPrivacyTile =
    authResolved && canInteract ? (
      viewerIsPremium ? (
        <CommunityLikesPrivateBanner />
      ) : (
        <CommunityLikesPrivateBanner showUpgradeHint />
      )
    ) : null;

  const feedBody =
    loading && feedHydratedRef.current ? (
      <div className="flex justify-center py-10 text-zinc-500 dark:text-zinc-400">
        <Loader2 className="h-8 w-8 animate-spin" aria-label="Loading" />
      </div>
    ) : loading && !feedHydratedRef.current && isX && !isPortal ? (
      <div className="flex min-h-[28vh] flex-1 flex-col items-center justify-center gap-3 py-12 text-zinc-500 dark:text-zinc-400">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        <span className="text-sm">Loading posts…</span>
      </div>
    ) : (
      <>
        <div className="space-y-4">
          {feedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={viewerUserId}
              onLikeToggle={onLikeToggle}
              onRequestShare={setShareTarget}
              onCommentCountChange={bumpCommentCount}
              onCommunityMutate={dispatchCommunityMutate}
              canInteract={canInteract}
              loginNextPath={loginNextPath}
              onNotifyError={reportActionError}
              skin={isX ? "x" : "default"}
              postDetailHref={isPortal ? `/posts/post/${post.id}` : `/community/post/${post.id}`}
              onPostRemoved={(removedId) => {
                setPosts((prev) => prev.filter((p) => p.id !== removedId));
              }}
              onPostUpdated={(updatedId, nextPost) => {
                setPosts((prev) =>
                  prev.map((p) => (p.id === updatedId ? { ...p, ...nextPost } : p))
                );
              }}
            />
          ))}
        </div>

        <div ref={loadMoreSentinelRef} className="h-4 w-full shrink-0" aria-hidden />

        {loadingMore ? (
          <div className="flex justify-center py-4 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading more" />
          </div>
        ) : null}

        {!loading && feedPosts.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            {(feedTab === "liked" || feedTab === "shared") && !canInteract ? (
              <>
                <a
                  href={`/login?next=${encodeURIComponent(loginNextPath)}`}
                  className="font-semibold text-zinc-800 underline decoration-zinc-400 hover:text-zinc-950 dark:text-zinc-200 dark:decoration-zinc-500"
                >
                  Sign in
                </a>{" "}
                to see posts you&apos;ve liked or shared.
              </>
            ) : isPortal && feedTab === "all" && !canInteract ? (
              <>
                <a
                  href={`/login?next=${encodeURIComponent(loginNextPath)}`}
                  className="font-semibold text-zinc-800 underline decoration-zinc-400 hover:text-zinc-950 dark:text-zinc-200 dark:decoration-zinc-500"
                >
                  Sign in
                </a>{" "}
                to see your posts here.
              </>
            ) : feedTab === "liked" ? (
              "You haven’t liked any posts yet."
            ) : feedTab === "shared" ? (
              "You haven’t shared any posts yet. Use Repost on a post to add it here."
            ) : isPortal ? (
              "You haven’t posted yet."
            ) : topicFilter ? (
              "No posts for this topic yet."
            ) : (
              "No posts yet. Be the first to share!"
            )}
          </p>
        ) : null}
      </>
    );

  const rootShell = cn(
    COMMUNITY_FEED_SHELL,
    isX && "flex min-h-0 flex-1 flex-col space-y-5 text-[15px]",
    containerClassName
  );

  return (
    <div className={rootShell}>
      {isX ? (
        <header className="space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className={COMMUNITY_FEED_HEADER_TITLE}>{title}</h1>
                {topicFilter ? (
                  <Link
                    href="/community"
                    className="text-sm font-semibold text-sky-400 underline-offset-2 hover:underline"
                  >
                    All posts
                  </Link>
                ) : null}
              </div>
              <p className={`mt-1 ${COMMUNITY_FEED_HEADER_SUB}`}>{subtitle}</p>
            </div>
            {!isPortal ? (
              <button
                type="button"
                onClick={() => void refreshFeed()}
                disabled={refreshing || loading}
                aria-label="Refresh feed"
                title="Refresh feed"
                className={COMMUNITY_BTN_SECONDARY}
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} aria-hidden />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            ) : null}
          </div>
        </header>
      ) : (
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">{title}</h1>
              {!isPortal && topicFilter ? (
                <Link
                  href="/community"
                  className="text-sm font-semibold text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
                >
                  All posts
                </Link>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
          </div>
          {isPortal ? (
            <Link
              href="/community"
              className="inline-flex shrink-0 items-center justify-center gap-0.5 self-start rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800/90"
            >
              Open Community
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </header>
      )}

      {composeForm}
      {guestPromo}
      {likesPrivacyTile}
      {isPortal ? tabBar : null}

      {error && !configError ? (
        <p className="px-4 text-sm text-rose-600 dark:text-rose-400 sm:px-0">{error}</p>
      ) : null}

      <div className={isX ? "min-h-0 flex-1" : undefined}>{feedBody}</div>

      {shareTarget ? (
        <SharePostModal
          post={shareTarget}
          onClose={() => setShareTarget(null)}
          onShared={(nextCount) => {
            applyShareCount(shareTarget.id, nextCount, shareTarget);
          }}
        />
      ) : null}
    </div>
  );
}
