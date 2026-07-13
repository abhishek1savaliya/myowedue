import ContactMessage from "@/models/ContactMessage";
import AdminUser from "@/models/AdminUser";
import {
  countCommunityTable,
  countPostsBetween,
  countPostsSince,
  fetchCommentCountsForPosts,
  fetchPostLikesForPosts,
  listRecentPostsForAnalytics,
} from "@/lib/community-db";
import { isCommunityConfigured } from "@/lib/community-server";

function statusMapFromAggregate(rows) {
  const map = {
    queued: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
  };
  for (const r of rows || []) {
    const k = r._id;
    if (k && map[k] !== undefined) map[k] = r.count;
  }
  return map;
}

async function fetchCommunityPostAnalytics(now) {
  const empty = {
    configured: false,
    totalPosts: 0,
    postsThisMonth: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    postsLast7Days: [],
    topPosts: [],
  };

  if (!isCommunityConfigured()) return empty;

  try {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [totalPosts, postsThisMonth, totalLikes, totalComments, totalShares] = await Promise.all([
      countCommunityTable("community_posts"),
      countPostsSince(monthStart),
      countCommunityTable("community_post_likes"),
      countCommunityTable("community_comments"),
      countCommunityTable("community_post_shares"),
    ]);

    const dayRanges = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      dayRanges.push({ d, next });
    }
    const dayCounts = await Promise.all(
      dayRanges.map(({ d, next }) => countPostsBetween(d.toISOString(), next.toISOString()))
    );
    const postsLast7Days = dayRanges.map(({ d }, i) => ({
      date: d.toISOString().slice(0, 10),
      shortLabel: d.toLocaleDateString(undefined, { weekday: "short" }),
      posts: dayCounts[i] || 0,
    }));

    const recentPosts = await listRecentPostsForAnalytics(40);

    let topPosts = [];
    if (recentPosts?.length) {
      const scored = [...recentPosts].sort((a, b) => (b.share_count || 0) - (a.share_count || 0)).slice(0, 5);
      const ids = scored.map((p) => p.id);
      const [likesIn, commentsIn] = await Promise.all([
        fetchPostLikesForPosts(ids),
        fetchCommentCountsForPosts(ids),
      ]);
      const likeByPost = new Map();
      const commentByPost = new Map();
      for (const row of likesIn || []) {
        likeByPost.set(row.post_id, (likeByPost.get(row.post_id) || 0) + 1);
      }
      for (const row of commentsIn || []) {
        commentByPost.set(row.post_id, (commentByPost.get(row.post_id) || 0) + 1);
      }
      topPosts = scored.map((p) => ({
        id: p.id,
        authorName: p.author_name || "—",
        bodyPreview: String(p.body || "").slice(0, 72) + (String(p.body || "").length > 72 ? "…" : ""),
        shares: p.share_count || 0,
        likes: likeByPost.get(p.id) || 0,
        comments: commentByPost.get(p.id) || 0,
        createdAt: p.created_at,
      }));
    }

    return {
      configured: true,
      totalPosts,
      postsThisMonth,
      totalLikes,
      totalComments,
      totalShares,
      postsLast7Days,
      topPosts,
    };
  } catch {
    return { ...empty, configured: true };
  }
}

export async function fetchSuperadminAnalyticsExtras(now = new Date()) {
  const [statusAgg, recentTickets, roleAgg, community] = await Promise.all([
    ContactMessage.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ContactMessage.find({})
      .sort({ createdAt: -1 })
      .limit(8)
      .select("name email status createdAt message")
      .lean(),
    AdminUser.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]),
    fetchCommunityPostAnalytics(now),
  ]);

  const ticketsByStatus = statusMapFromAggregate(statusAgg);
  const ticketTotal = Object.values(ticketsByStatus).reduce((a, b) => a + b, 0);

  const teamByRole = { superadmin: 0, manager: 0, support: 0 };
  for (const r of roleAgg || []) {
    const role = r._id;
    if (role && teamByRole[role] !== undefined) teamByRole[role] = r.count;
  }

  return {
    tickets: {
      total: ticketTotal,
      byStatus: ticketsByStatus,
      recent: recentTickets.map((t) => ({
        id: t._id.toString(),
        name: t.name,
        email: t.email,
        status: t.status,
        createdAt: t.createdAt,
        preview: String(t.message || "").slice(0, 80),
      })),
    },
    team: {
      byRole: teamByRole,
      activeTotal: Object.values(teamByRole).reduce((a, b) => a + b, 0),
    },
    posts: community,
  };
}
