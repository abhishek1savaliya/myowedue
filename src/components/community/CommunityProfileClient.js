"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Calendar, Loader2, Share2, UserPlus } from "lucide-react";
import { format } from "date-fns";
import ModalPortal from "@/components/ModalPortal";
import { PostCard } from "@/components/community/CommunityFeedClient";
import ShareProfileModal from "@/components/community/ShareProfileModal";
import SharePostModal from "@/components/community/SharePostModal";

/** Split display name for a subtle two-tone accent (home-style warmth + teal), without breaking single names. */
function DisplayNameHeading({ name }) {
  const parts = String(name || "Member").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0];
    const rest = parts.slice(1).join(" ");
    return (
      <h1 className="text-xl font-bold sm:text-2xl">
        <span className="text-amber-700 dark:text-amber-400">{first}</span>{" "}
        <span className="text-teal-700 dark:text-teal-400">{rest}</span>
      </h1>
    );
  }
  return (
    <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl dark:text-zinc-50">{name || "Member"}</h1>
  );
}

export default function CommunityProfileClient({ username: usernameParam }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [profilePosts, setProfilePosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postShareTarget, setPostShareTarget] = useState(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [postsFilter, setPostsFilter] = useState("all");
  const [visibilitySaving, setVisibilitySaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/community/profile/${encodeURIComponent(usernameParam)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProfile(null);
        setError(data.message || "Could not load profile.");
        return;
      }
      setProfile(data.profile || null);
    } catch {
      setProfile(null);
      setError("Could not load profile.");
    } finally {
      setLoading(false);
    }
  }, [usernameParam]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!profile?.username) return;
    if (profile?.visibility === "private" && !profile?.viewer?.isSelf) {
      setProfilePosts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setPostsLoading(true);
      try {
        const qs = postsFilter === "all" ? "" : `?filter=${encodeURIComponent(postsFilter)}`;
        const res = await fetch(`/api/community/profile/${encodeURIComponent(profile.username)}/posts${qs}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) return;
        setProfilePosts(Array.isArray(data.posts) ? data.posts : []);
        setCurrentUserId(data.currentUserId || "");
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.username, profile?.visibility, profile?.viewer?.isSelf, postsFilter]);

  async function toggleFollow() {
    if (!profile?.viewer || profile.viewer.isSelf) return;
    setFollowBusy(true);
    try {
      const res = await fetch(`/api/community/profile/${encodeURIComponent(usernameParam)}/follow`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/community/user/${usernameParam}`)}`);
        return;
      }
      if (!res.ok) {
        return;
      }
      const nextFollowing = Boolean(data.following);
      setProfile((p) => {
        if (!p?.viewer) return p;
        const delta = nextFollowing ? 1 : -1;
        return {
          ...p,
          viewer: { ...p.viewer, isFollowing: nextFollowing },
          followersCount: Math.max(0, (p.followersCount ?? 0) + delta),
        };
      });
    } finally {
      setFollowBusy(false);
    }
  }

  function shareProfile() {
    setShareOpen(true);
  }

  async function onLikeToggle(post) {
    if (!currentUserId) {
      router.push(`/login?next=${encodeURIComponent(`/community/user/${usernameParam}`)}`);
      return;
    }
    const prevPosts = profilePosts;
    const prev = profilePosts.find((p) => p.id === post.id);
    const nextLiked = !Boolean(prev?.liked);
    setProfilePosts((list) =>
      list.map((p) =>
        p.id === post.id ? { ...p, liked: nextLiked, likeCount: Math.max(0, (p.likeCount || 0) + (nextLiked ? 1 : -1)) } : p
      )
    );
    try {
      const res = await fetch(`/api/community/posts/${post.id}/like`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed");
      setProfilePosts((list) =>
        list.map((p) =>
          p.id === post.id
            ? {
                ...p,
                liked: Boolean(data.liked),
                likeCount:
                  typeof data.likeCount === "number"
                    ? data.likeCount
                    : Math.max(0, (p.likeCount || 0) + (data.liked ? 1 : -1)),
              }
            : p
        )
      );
    } catch {
      setProfilePosts(prevPosts);
    }
  }

  async function updateVisibility(nextVisibility) {
    if (!profile?.viewer?.isSelf || visibilitySaving) return;
    const next = nextVisibility === "private" ? "private" : "public";
    const prev = profile?.visibility === "private" ? "private" : "public";
    if (next === prev) return;
    setVisibilitySaving(true);
    setProfile((p) => (p ? { ...p, visibility: next } : p));
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ communityProfileVisibility: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to save");
      const saved = data.communityProfileVisibility === "private" ? "private" : "public";
      setProfile((p) => (p ? { ...p, visibility: saved } : p));
    } catch {
      setProfile((p) => (p ? { ...p, visibility: prev } : p));
    } finally {
      setVisibilitySaving(false);
    }
  }

  function bumpCommentCount(postId, delta) {
    setProfilePosts((list) =>
      list.map((p) => (p.id === postId ? { ...p, commentCount: Math.max(0, (p.commentCount || 0) + delta) } : p))
    );
  }

  const joinedLabel = profile?.joinedAt ? format(new Date(profile.joinedAt), "MMMM yyyy") : null;
  const followersCount = profile?.followersCount ?? 0;
  const followingCount = profile?.followingCount ?? 0;
  const isPrivateForViewer = profile?.visibility === "private" && !profile?.viewer?.isSelf;

  return (
    <div className="min-h-0 bg-background">
      <div className="border-b border-zinc-200/90 bg-white/90 px-4 py-3 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-950/90">
        <Link
          href="/community"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <span className="text-sm">Loading profile…</span>
        </div>
      ) : error ? (
        <div className="px-4 py-10">
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">{error}</p>
          <p className="mt-4 text-center">
            <Link
              href="/community"
              className="text-sm font-semibold text-amber-700 underline underline-offset-2 dark:text-amber-400"
            >
              Return to community
            </Link>
          </p>
        </div>
      ) : profile ? (
        <div className="px-4 pb-12 pt-4 sm:px-6">
          {shareOpen ? (
            <ModalPortal>
              <ShareProfileModal
                username={profile?.username || usernameParam}
                displayName={profile?.displayName}
                onClose={() => setShareOpen(false)}
              />
            </ModalPortal>
          ) : null}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:border-zinc-700 dark:bg-zinc-900/80">
            <div
              className="h-28 bg-linear-to-r from-amber-100/90 via-zinc-100 to-emerald-100/80 sm:h-32 dark:from-amber-950/40 dark:via-zinc-900 dark:to-emerald-950/30"
              aria-hidden
            />
            <div className="relative px-4 pb-8 sm:px-6">
              <div className="-mt-12 flex flex-wrap items-end justify-between gap-3 sm:-mt-14">
                <div
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-white bg-zinc-100 text-2xl font-bold text-zinc-800 shadow-sm dark:border-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 sm:h-28 sm:w-28"
                  aria-hidden
                >
                  {String(profile.displayName || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 pb-1 sm:pb-2">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {profile?.viewer?.isSelf ? (
                      <div className="inline-flex items-center rounded-full border border-zinc-300 bg-white p-1 shadow-sm dark:border-zinc-600 dark:bg-zinc-800">
                        {[
                          ["public", "Public"],
                          ["private", "Private"],
                        ].map(([id, label]) => {
                          const active = (profile?.visibility || "public") === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              disabled={visibilitySaving}
                              onClick={() => void updateVisibility(id)}
                              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                active
                                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    {!isPrivateForViewer && profile.viewer && !profile.viewer.isSelf ? (
                      profile.viewer.isFollowing ? (
                      <button
                        type="button"
                        onClick={() => void toggleFollow()}
                        disabled={followBusy}
                        className="inline-flex min-h-10 items-center justify-center rounded-full border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                      >
                        {followBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Following"}
                      </button>
                      ) : (
                      <button
                        type="button"
                        onClick={() => void toggleFollow()}
                        disabled={followBusy}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                      >
                        {followBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4" aria-hidden />
                            Follow
                          </>
                        )}
                      </button>
                      )
                    ) : !isPrivateForViewer && !profile.viewer ? (
                      <Link
                        href={`/login?next=${encodeURIComponent(`/community/user/${usernameParam}`)}`}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                      >
                        <UserPlus className="h-4 w-4" aria-hidden />
                        Follow
                      </Link>
                    ) : null}
                    {!isPrivateForViewer ? (
                      <button
                        type="button"
                        onClick={() => void shareProfile()}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                      >
                        <Share2 className="h-4 w-4" aria-hidden />
                        Share profile
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mt-4 max-w-xl">
                <DisplayNameHeading name={profile.displayName} />
                <p className="mt-1 flex flex-wrap items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <span>@{profile.username}</span>
                  {profile.verified && !isPrivateForViewer ? (
                    <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400">
                      <BadgeCheck className="h-4 w-4" aria-hidden />
                      Verified
                    </span>
                  ) : null}
                </p>
                {!isPrivateForViewer ? (
                  <>
                    <p className="mt-2 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                      <Link
                        href={`/community/user/${encodeURIComponent(profile.username)}/followers`}
                        className="font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950 dark:text-zinc-200 dark:decoration-zinc-600 dark:hover:text-white"
                      >
                        {followersCount} followers
                      </Link>
                      <span className="mx-2 text-zinc-300 dark:text-zinc-600">·</span>
                      <Link
                        href={`/community/user/${encodeURIComponent(profile.username)}/following`}
                        className="font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950 dark:text-zinc-200 dark:decoration-zinc-600 dark:hover:text-white"
                      >
                        {followingCount} following
                      </Link>
                    </p>
                    {joinedLabel ? (
                      <p className="mt-4 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                        <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                        Joined {joinedLabel}
                      </p>
                    ) : null}
                    <p className="mt-6 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      Public community profile. Posts and replies from this member appear in the{" "}
                      <Link href="/community" className="font-semibold text-amber-700 underline underline-offset-2 dark:text-amber-400">
                        community feed
                      </Link>
                      .
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                    This member has set the profile to private.
                  </p>
                )}
              </div>
            </div>
          </div>

          {!isPrivateForViewer ? (
            <section className="mt-6">
              <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-1.5 dark:border-zinc-700 dark:bg-zinc-900/80">
                <div className="grid grid-cols-3 gap-1">
                  {[
                    ["all", "My posts"],
                    ["liked", "Liked"],
                    ["shared", "Shared"],
                  ].map(([id, label]) => {
                    const active = postsFilter === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPostsFilter(id)}
                        className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                          active
                            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"
                            : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {postsLoading ? (
                <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading posts…
                </div>
              ) : profilePosts.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white px-4 py-5 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400">
                  {postsFilter === "all" ? "No posts yet." : postsFilter === "liked" ? "No liked posts yet." : "No shared posts yet."}
                </div>
              ) : (
                <div className="space-y-4">
                  {profilePosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUserId={currentUserId}
                      onLikeToggle={onLikeToggle}
                      onRequestShare={setPostShareTarget}
                      onCommentCountChange={bumpCommentCount}
                      onCommunityMutate={() => {}}
                      canInteract={Boolean(currentUserId)}
                      loginNextPath={`/community/user/${encodeURIComponent(usernameParam)}`}
                      onNotifyError={() => {}}
                      skin="default"
                      postDetailHref={`/community/post/${post.id}`}
                      onPostRemoved={(removedId) => {
                        setProfilePosts((list) => list.filter((p) => p.id !== removedId));
                      }}
                      onPostUpdated={(updatedId, nextPost) => {
                        setProfilePosts((list) => list.map((p) => (p.id === updatedId ? { ...p, ...nextPost } : p)));
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : null}

        </div>
      ) : null}
      {postShareTarget ? (
        <SharePostModal
          post={postShareTarget}
          onClose={() => setPostShareTarget(null)}
          onShared={(nextCount) => {
            setProfilePosts((list) =>
              list.map((p) => (p.id === postShareTarget.id ? { ...p, share_count: nextCount } : p))
            );
          }}
        />
      ) : null}
    </div>
  );
}
