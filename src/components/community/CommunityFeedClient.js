"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { BadgeCheck, ChevronRight, Heart, Loader2, MessageCircle, Repeat2, Send } from "lucide-react";
import { dispatchCommunityMutate } from "@/lib/community-mutate-event";

const COMMUNITY_SETUP_MESSAGE =
  "Posts use Supabase Postgres (SQL); the rest of the app uses MongoDB. Either add SUPABASE_DATABASE_URL (direct Postgres URI from Supabase → Database → Connection string) so tables can be created automatically, or open SQL Editor and run supabase/migrations/001_community.sql, 002_community_post_shares.sql, and 003_post_topics.sql for the same project as NEXT_PUBLIC_SUPABASE_URL. Ensure NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (optional for future client use) and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) match that project.";

function isMissingCommunityTables(message) {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("schema cache") ||
    m.includes("community_posts") ||
    m.includes("community_post_shares") ||
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

function CommentBranch({ node, postId, depth, onRefresh, onThreadMutate, currentUserId, canInteract, loginNextPath, onNotifyError, skin = "default" }) {
  const router = useRouter();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  function goLogin() {
    router.push(`/login?next=${encodeURIComponent(loginNextPath)}`);
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
      onThreadMutate?.();
      onRefresh();
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
            : "rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 dark:border-zinc-700 dark:bg-slate-800/60"
        }
      >
        <p className={`text-xs font-semibold ${isX ? "text-zinc-100" : "text-zinc-800 dark:text-zinc-200"}`}>
          {node.author_name}
          {node.author_id === currentUserId ? (
            <span className={`ml-1 font-normal ${isX ? "text-sky-400" : "text-amber-600 dark:text-amber-400"}`}>(you)</span>
          ) : null}
        </p>
        <p className={`mt-1 whitespace-pre-wrap text-sm ${isX ? "text-zinc-200" : "text-zinc-700 dark:text-zinc-300"}`}>{node.body}</p>
        <p className={`mt-1 text-[11px] ${isX ? "text-zinc-500" : "text-zinc-500"}`}>
          {formatDistanceToNow(new Date(node.created_at), { addSuffix: true })}
        </p>
        <button
          type="button"
          onClick={() => {
            if (!canInteract) {
              goLogin();
              return;
            }
            setReplyOpen((v) => !v);
          }}
          className={`mt-2 text-xs font-semibold ${isX ? "text-sky-500 hover:underline" : "text-amber-700 hover:underline dark:text-amber-400"}`}
        >
          {!canInteract ? "Sign in to reply" : replyOpen ? "Cancel" : "Reply"}
        </button>
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
                  : "min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-slate-900 dark:text-zinc-100"
              }
            />
            <button
              type="submit"
              disabled={sending || !replyText.trim()}
              className={
                isX
                  ? "inline-flex items-center justify-center gap-1 rounded-full bg-sky-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                  : "inline-flex items-center justify-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
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
              onThreadMutate={onThreadMutate}
              currentUserId={currentUserId}
              canInteract={canInteract}
              loginNextPath={loginNextPath}
              onNotifyError={onNotifyError}
              skin={skin}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PostCard({
  post,
  currentUserId,
  onLikeToggle,
  onShare,
  onCommentCountChange,
  onCommunityMutate,
  canInteract,
  loginNextPath,
  onNotifyError,
  skin = "default",
}) {
  const router = useRouter();
  const isX = skin === "x";
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  function goLogin() {
    router.push(`/login?next=${encodeURIComponent(loginNextPath)}`);
  }

  const loadComments = useCallback(async () => {
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
  }, [post.id]);

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
      await loadComments();
      onCommentCountChange(post.id, 1);
      onCommunityMutate?.();
    } catch (err) {
      onNotifyError?.(err.message || "Failed to comment");
    } finally {
      setPostingComment(false);
    }
  }

  if (isX) {
    return (
      <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-slate-900/80">
        <div
          className="h-1 w-full bg-linear-to-r from-amber-400 via-emerald-500 to-sky-500"
          aria-hidden
        />
        <div className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex flex-wrap items-center gap-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <span>{post.author_name}</span>
                {post.authorVerified ? (
                  <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" aria-label="Verified" title="Verified" />
                ) : null}
                {post.author_id === currentUserId ? (
                  <span className="text-xs font-normal text-amber-600 dark:text-amber-400">(you)</span>
                ) : null}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">{post.body}</p>
          <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-stone-100 pt-3 dark:border-zinc-800">
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
                  : "text-zinc-600 hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-slate-800"
              }`}
            >
              <Heart className={`h-4 w-4 ${post.liked ? "fill-current" : ""}`} strokeWidth={2} />
              {post.likeCount || 0}
            </button>
            <button
              type="button"
              onClick={() => {
                setCommentsOpen((v) => {
                  const next = !v;
                  if (next) loadComments();
                  return next;
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-slate-800"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2} />
              {post.commentCount || 0}
            </button>
            <button
              type="button"
              onClick={() => onShare(post)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-slate-800"
            >
              <Repeat2 className="h-4 w-4" strokeWidth={2} />
              {post.share_count ?? 0}
            </button>
          </div>
          {commentsOpen ? (
            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-zinc-800">
              {canInteract ? (
                <form onSubmit={submitTopComment} className="mb-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    maxLength={500}
                    placeholder="Add a comment…"
                    className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-slate-950 dark:text-zinc-100"
                  />
                  <button
                    type="submit"
                    disabled={postingComment || !commentText.trim()}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {postingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Comment
                  </button>
                </form>
              ) : (
                <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                  <button type="button" onClick={goLogin} className="font-semibold text-amber-700 underline dark:text-amber-400">
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
                        loadComments();
                        onCommentCountChange(post.id, 1);
                      }}
                      onThreadMutate={onCommunityMutate}
                      currentUserId={currentUserId}
                      canInteract={canInteract}
                      loginNextPath={loginNextPath}
                      onNotifyError={onNotifyError}
                      skin="default"
                    />
                  ))}
                  {comments.length === 0 ? <p className="text-sm text-zinc-500">No comments yet.</p> : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-slate-900/80 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <span>{post.author_name}</span>
            {post.authorVerified ? (
              <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" aria-label="Verified" title="Verified" />
            ) : null}
            {post.author_id === currentUserId ? (
              <span className="text-xs font-normal text-amber-600 dark:text-amber-400">(you)</span>
            ) : null}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">{post.body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
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
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-slate-800"
          }`}
        >
          <Heart className={`h-4 w-4 ${post.liked ? "fill-current" : ""}`} strokeWidth={2} />
          {post.likeCount || 0}
        </button>
        <button
          type="button"
          onClick={() => {
            setCommentsOpen((v) => {
              const next = !v;
              if (next) loadComments();
              return next;
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-slate-800"
        >
          <MessageCircle className="h-4 w-4" strokeWidth={2} />
          {post.commentCount || 0}
        </button>
        <button
          type="button"
          onClick={() => onShare(post)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-slate-800"
        >
          <Repeat2 className="h-4 w-4" strokeWidth={2} />
          {post.share_count ?? 0}
        </button>
      </div>
      {commentsOpen ? (
        <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          {canInteract ? (
            <form onSubmit={submitTopComment} className="mb-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                maxLength={500}
                placeholder="Add a comment…"
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-slate-950 dark:text-zinc-100"
              />
              <button
                type="submit"
                disabled={postingComment || !commentText.trim()}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-amber-600"
              >
                {postingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Comment
              </button>
            </form>
          ) : (
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              <button type="button" onClick={goLogin} className="font-semibold text-amber-700 underline dark:text-amber-400">
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
                    loadComments();
                    onCommentCountChange(post.id, 1);
                  }}
                  onThreadMutate={onCommunityMutate}
                  currentUserId={currentUserId}
                  canInteract={canInteract}
                  loginNextPath={loginNextPath}
                  onNotifyError={onNotifyError}
                  skin="default"
                />
              ))}
              {comments.length === 0 ? <p className="text-sm text-zinc-500">No comments yet.</p> : null}
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}

/**
 * @param {{ variant?: "portal" | "public"; shareBasePath?: string; loginNextPath?: string; skin?: "default" | "x"; containerClassName?: string }} props
 */
const FEED_TABS = [
  { id: "all", label: "All posts" },
  { id: "liked", label: "Liked" },
  { id: "shared", label: "Shared" },
];

const FEED_TABS_PORTAL = [
  { id: "all", label: "My posts" },
  { id: "liked", label: "Liked" },
  { id: "shared", label: "Shared" },
];

const FEED_TABS_X = [
  { id: "all", label: "All posts" },
  { id: "liked", label: "Liked" },
  { id: "shared", label: "Shared" },
];

const FEED_TABS_PORTAL_X = [
  { id: "all", label: "My posts" },
  { id: "liked", label: "Liked" },
  { id: "shared", label: "Shared" },
];

/** Portal home tab lists only the signed-in user’s posts (`filter=mine`). Community lists everyone. */
function buildPostsQuery(tab, cursor, portalMineHome) {
  const p = new URLSearchParams();
  if (portalMineHome && tab === "all") p.set("filter", "mine");
  else if (tab && tab !== "all") p.set("filter", tab);
  if (cursor) p.set("cursor", cursor);
  const qs = p.toString();
  return qs ? `/api/community/posts?${qs}` : "/api/community/posts";
}

export default function CommunityFeedClient({
  variant = "portal",
  shareBasePath = "/community",
  loginNextPath = "/community",
  skin = "default",
  containerClassName = "",
}) {
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [composer, setComposer] = useState("");
  const [posting, setPosting] = useState(false);
  const [configError, setConfigError] = useState(false);
  const [feedTab, setFeedTab] = useState("all");
  /** From feed API: premium + verified badge preference for signed-in viewer. */
  const [viewer, setViewer] = useState(null);
  const [savingVerifiedBadge, setSavingVerifiedBadge] = useState(false);

  const isPortal = variant === "portal";
  const isX = !isPortal && skin === "x";
  const feedTabs = useMemo(() => {
    if (!isPortal) return isX ? FEED_TABS_X : FEED_TABS;
    return isX ? FEED_TABS_PORTAL_X : FEED_TABS_PORTAL;
  }, [isPortal, isX]);
  const portalMineHome = isPortal;
  const canInteract = Boolean(currentUserId);

  const nextCursorRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const loadMoreSentinelRef = useRef(null);
  /** After first successful feed GET, tab switches use inline loading instead of a full-page spinner. */
  const feedHydratedRef = useRef(false);
  const loadingRef = useRef(false);

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

  const updateVerifiedBadge = useCallback(
    async (next) => {
      if (!viewer?.isPremium || savingVerifiedBadge) return;
      setSavingVerifiedBadge(true);
      try {
        const res = await fetch("/api/auth/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ showVerifiedBadge: next }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Failed to save");
        const uid = data.user?.id ? String(data.user.id) : "";
        setViewer({
          isPremium: Boolean(data.user?.isPremium),
          showVerifiedBadge: Boolean(data.user?.showVerifiedBadge),
        });
        if (uid) {
          setPosts((prev) =>
            prev.map((p) =>
              String(p.author_id) === uid ? { ...p, authorVerified: Boolean(data.user?.showVerifiedBadge) } : p
            )
          );
        }
        dispatchCommunityMutate();
      } catch (e) {
        reportActionError(e.message || "Failed to save");
      } finally {
        setSavingVerifiedBadge(false);
      }
    },
    [viewer?.isPremium, savingVerifiedBadge, reportActionError]
  );

  /** Refetch liked/shared when session becomes available; ignore user id changes on "all" to avoid double fetch. */
  const tabAuthKey = useMemo(
    () => (feedTab === "liked" || feedTab === "shared" ? currentUserId || "__guest__" : "__all__"),
    [feedTab, currentUserId]
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if ((feedTab === "liked" || feedTab === "shared") && !currentUserId) {
        setPosts([]);
        setNextCursor(null);
        nextCursorRef.current = null;
        setViewer(null);
        setLoading(false);
        setError("");
        return;
      }

      setLoading(true);
      setError("");
      setPosts([]);
      setNextCursor(null);
      nextCursorRef.current = null;
      try {
        const res = await fetch(buildPostsQuery(feedTab, null, portalMineHome), { credentials: "include", cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 503) {
          setConfigError(true);
          setError(data.message || "Community is not configured.");
          setPosts([]);
          return;
        }
        if (!res.ok) {
          const msg = data.message || "Failed to load posts";
          if (isMissingCommunityTables(msg)) {
            setConfigError(true);
            setError(COMMUNITY_SETUP_MESSAGE);
            setPosts([]);
            return;
          }
          throw new Error(msg);
        }
        setConfigError(false);
        setPosts(data.posts || []);
        setNextCursor(data.nextCursor || null);
        setCurrentUserId(data.currentUserId || "");
        setViewer(data.viewer ?? null);
        feedHydratedRef.current = true;
      } catch (e) {
        if (cancelled) return;
        const msg = e.message || "Failed to load";
        if (isMissingCommunityTables(msg)) {
          setConfigError(true);
          setError(COMMUNITY_SETUP_MESSAGE);
        } else {
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [feedTab, tabAuthKey, portalMineHome]);

  const loadMore = useCallback(async () => {
    const cursor = nextCursorRef.current;
    if (!cursor || loadingMoreRef.current) return;
    if ((feedTab === "liked" || feedTab === "shared") && !currentUserId) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(buildPostsQuery(feedTab, cursor, portalMineHome), {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to load more");
      setPosts((prev) => [...prev, ...(data.posts || [])]);
      setNextCursor(data.nextCursor || null);
      setCurrentUserId(data.currentUserId || "");
      if (data.viewer !== undefined) setViewer(data.viewer ?? null);
    } catch (e) {
      reportActionError(e.message || "Failed to load more");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [feedTab, currentUserId, reportActionError, portalMineHome]);

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
  }, [loadMore, posts.length, feedTab]);

  async function createPost(e) {
    e.preventDefault();
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
      if (feedTab === "all") {
        setPosts((prev) => [data.post, ...prev]);
      }
      dispatchCommunityMutate();
    } catch (err) {
      reportActionError(err.message || "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  async function onLikeToggle(post) {
    try {
      const res = await fetch(`/api/community/posts/${post.id}/like`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || "Failed";
        if (res.status === 503) {
          setConfigError(true);
          setError(msg);
        } else {
          throw new Error(msg);
        }
        return;
      }
      dispatchCommunityMutate();
      const liked = data.liked;
      if (feedTab === "liked" && !liked) {
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
      } else {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  liked,
                  likeCount: Math.max(0, (p.likeCount || 0) + (liked ? 1 : -1)),
                }
              : p
          )
        );
      }
    } catch (e) {
      reportActionError(e.message || "Failed");
    }
  }

  async function onShare(post) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const path = shareBasePath.startsWith("/") ? shareBasePath : `/${shareBasePath}`;
    const shareUrl =
      origin && post?.id ? `${origin}${path}?post=${encodeURIComponent(post.id)}` : `${origin}${path}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "OWE DUE Community",
          text: post.body.slice(0, 120),
          url: shareUrl,
        });
      } else if (shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link copied to clipboard.");
      }
    } catch {
      /* user cancelled share */
    }
    try {
      const res = await fetch(`/api/community/posts/${post.id}/share`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const nextCount = data.shareCount;
        setPosts((prev) => {
          const mapped = prev.map((p) => (p.id === post.id ? { ...p, share_count: nextCount } : p));
          if (feedTab === "shared" && canInteract && !mapped.some((p) => p.id === post.id)) {
            return [{ ...post, share_count: nextCount }, ...mapped];
          }
          return mapped;
        });
        dispatchCommunityMutate();
      }
    } catch {
      /* ignore */
    }
  }

  function bumpCommentCount(postId, delta) {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentCount: Math.max(0, (p.commentCount || 0) + delta) } : p))
    );
  }

  if (loading && !feedHydratedRef.current) {
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
        error.includes("SUPABASE_DATABASE_URL") ||
        error.includes("MongoDB"));
    return (
      <div
        className={
          isX
            ? "rounded-2xl border border-amber-400/60 bg-white p-6 text-stone-900 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/90 dark:text-amber-50"
            : "rounded-2xl border border-amber-400/60 bg-white p-6 text-stone-900 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/90 dark:text-amber-50"
        }
      >
        <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-200">Community unavailable</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-800 dark:text-amber-100/95">{error}</p>
        {!setupIncluded ? (
          <p className="mt-3 text-sm leading-relaxed text-stone-700 dark:text-amber-100/90">
            Add <code className="rounded bg-stone-200 px-1.5 py-0.5 text-xs font-mono text-stone-900 dark:bg-amber-900/60 dark:text-amber-50">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
            <code className="rounded bg-stone-200 px-1.5 py-0.5 text-xs font-mono text-stone-900 dark:bg-amber-900/60 dark:text-amber-50">SUPABASE_SERVICE_ROLE_KEY</code> (or <code className="rounded bg-stone-200 px-1.5 py-0.5 text-xs font-mono text-stone-900 dark:bg-amber-900/60 dark:text-amber-50">SUPABASE_SECRET_KEY</code>) from Supabase Dashboard → Settings → API,
            and run the SQL in <code className="rounded bg-stone-200 px-1.5 py-0.5 text-xs font-mono text-stone-900 dark:bg-amber-900/60 dark:text-amber-50">supabase/migrations/001_community.sql</code>.
          </p>
        ) : null}
      </div>
    );
  }

  const title = isPortal ? "Posts" : "Community";
  const subtitle = isPortal
    ? "This page shows only your posts. Open Community to read and join the full public feed."
    : "Anyone can read and share posts. Sign in to publish, like, or comment.";

  const showComposer = isPortal || canInteract;

  const tabBar = (
    <div
      className={
        isX
          ? "flex gap-1 rounded-2xl border border-stone-200 bg-stone-100/90 p-1 dark:border-zinc-700 dark:bg-slate-800/80"
          : "flex gap-1 rounded-2xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-slate-900/60"
      }
      role="tablist"
      aria-label="Feed filter"
    >
      {feedTabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={feedTab === t.id}
          onClick={() => setFeedTab(t.id)}
          className={`min-h-[44px] flex-1 rounded-xl px-2 text-center text-xs font-semibold transition sm:text-sm ${
            feedTab === t.id
              ? "bg-white text-zinc-900 shadow-sm dark:bg-slate-800 dark:text-zinc-100"
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
          ? "rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-slate-900/80"
          : "rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-slate-900/80"
      }
    >
      <label className="sr-only" htmlFor="community-compose">
        What&apos;s happening?
      </label>
      <textarea
        id="community-compose"
        value={composer}
        onChange={(e) => setComposer(e.target.value)}
        maxLength={280}
        rows={3}
        placeholder="What’s happening?"
        className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400 focus:outline-none dark:border-zinc-600 dark:bg-slate-950 dark:text-zinc-100"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-500">{composer.length}/280</span>
        <button
          type="submit"
          disabled={posting || !composer.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Post
        </button>
      </div>
    </form>
  ) : null;

  const guestPromo =
    !showComposer && !isPortal ? (
      <div
        className={
          isX
            ? "rounded-2xl border border-stone-200 bg-stone-50/90 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-slate-800/60 dark:text-zinc-200"
            : "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-slate-800/60 dark:text-zinc-200"
        }
      >
        <a
          href={`/login?next=${encodeURIComponent(loginNextPath)}`}
          className="font-semibold text-amber-700 hover:underline dark:text-amber-400"
        >
          Sign in
        </a>{" "}
        or{" "}
        <a href="/signup" className="font-semibold text-amber-700 hover:underline dark:text-amber-400">
          create an account
        </a>{" "}
        to publish, like, or comment. You can share posts without signing in.
      </div>
    ) : null;

  const feedBody =
    loading && feedHydratedRef.current ? (
      <div className="flex justify-center py-10 text-zinc-500 dark:text-zinc-400">
        <Loader2 className="h-8 w-8 animate-spin" aria-label="Loading" />
      </div>
    ) : (
      <>
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              onLikeToggle={onLikeToggle}
              onShare={onShare}
              onCommentCountChange={bumpCommentCount}
              onCommunityMutate={dispatchCommunityMutate}
              canInteract={canInteract}
              loginNextPath={loginNextPath}
              onNotifyError={reportActionError}
              skin={isX ? "x" : "default"}
            />
          ))}
        </div>

        <div ref={loadMoreSentinelRef} className="h-4 w-full shrink-0" aria-hidden />

        {loadingMore ? (
          <div className="flex justify-center py-4 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading more" />
          </div>
        ) : null}

        {!loading && posts.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            {(feedTab === "liked" || feedTab === "shared") && !canInteract ? (
              <>
                <a
                  href={`/login?next=${encodeURIComponent(loginNextPath)}`}
                  className="font-semibold text-amber-700 underline hover:text-amber-800 dark:text-amber-400"
                >
                  Sign in
                </a>{" "}
                to see posts you&apos;ve liked or shared.
              </>
            ) : isPortal && feedTab === "all" && !canInteract ? (
              <>
                <a
                  href={`/login?next=${encodeURIComponent(loginNextPath)}`}
                  className="font-semibold text-amber-700 underline hover:text-amber-800 dark:text-amber-400"
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
            ) : (
              "No posts yet. Be the first to share!"
            )}
          </p>
        ) : null}
      </>
    );

  const rootShell = isX
    ? `mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col space-y-5 px-3 py-4 text-[15px] md:px-4 md:py-6 ${containerClassName}`.trim()
    : `mx-auto max-w-xl space-y-6 ${containerClassName}`.trim();

  return (
    <div className={rootShell}>
      {isX ? (
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            <span className="bg-linear-to-r from-amber-600 via-emerald-600 to-sky-600 bg-clip-text text-transparent dark:from-amber-400 dark:via-emerald-400 dark:to-sky-400">
              Community
            </span>
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
        </header>
      ) : (
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{title}</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
          </div>
          {isPortal ? (
            <Link
              href="/community"
              className="inline-flex shrink-0 items-center justify-center gap-0.5 self-start rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-slate-800 dark:text-amber-400 dark:hover:bg-slate-800/90"
            >
              Open Community
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </header>
      )}

      {composeForm}
      {guestPromo}
      {tabBar}

      {canInteract && viewer?.isPremium ? (
        <div
          className={
            isX
              ? "rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-slate-900/80"
              : "rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-slate-900/80"
          }
        >
          <div className="flex gap-3">
            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" aria-hidden />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Verified badge</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                Show a blue check next to your name on posts so others know your account is verified.
              </p>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 text-sky-600 focus:ring-sky-500 dark:border-zinc-600 dark:bg-slate-900"
                  checked={Boolean(viewer.showVerifiedBadge)}
                  disabled={savingVerifiedBadge}
                  onChange={(e) => void updateVerifiedBadge(e.target.checked)}
                />
                <span>Show verified badge publicly</span>
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {error && !configError ? (
        <p className="px-4 text-sm text-rose-600 dark:text-rose-400 sm:px-0">{error}</p>
      ) : null}

      <div className={isX ? "min-h-0 flex-1" : undefined}>{feedBody}</div>
    </div>
  );
}
