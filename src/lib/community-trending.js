/**
 * Aggregate trending topics from posts in the last window, with engagement score and time decay.
 * @param {Array<{ id: string; share_count?: number; created_at: string }>} posts
 * @param {Array<{ post_id: string; topic: string }>} topicRows
 * @param {Array<{ post_id: string }>} likeRows
 * @param {Array<{ post_id: string }>} commentRows
 * @param {{ nowMs?: number; windowHours?: number; limit?: number }} opts
 */
export function computeTrendingTopics(posts, topicRows, likeRows, commentRows, opts = {}) {
  const nowMs = opts.nowMs ?? Date.now();
  const limit = Math.min(Math.max(Number(opts.limit) || 10, 1), 50);
  const minHours = 1 / 60;

  const likeCount = {};
  for (const r of likeRows || []) {
    const id = String(r.post_id);
    likeCount[id] = (likeCount[id] || 0) + 1;
  }
  const commentCount = {};
  for (const r of commentRows || []) {
    const id = String(r.post_id);
    commentCount[id] = (commentCount[id] || 0) + 1;
  }

  const postById = new Map((posts || []).map((p) => [String(p.id), p]));

  /** @type {Map<string, { trend_score: number; posts: Set<string> }>} */
  const byTopic = new Map();

  for (const row of topicRows || []) {
    const postId = String(row.post_id);
    const topic = String(row.topic || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
    if (!topic) continue;

    const post = postById.get(postId);
    if (!post) continue;

    const likes = likeCount[postId] || 0;
    const comments = commentCount[postId] || 0;
    const shares = Number(post.share_count || 0);
    const baseScore = likes * 2 + comments * 3 + shares * 5;
    /** So topics from many low-engagement posts (e.g. new Gujarati threads) still surface in trending. */
    const mentionFloor = 0.18;

    const created = new Date(post.created_at).getTime();
    const hoursSince = Math.max((nowMs - created) / 3600000, minHours);
    const decayed = (Math.max(baseScore, 0) + mentionFloor) / hoursSince;

    if (!byTopic.has(topic)) {
      byTopic.set(topic, { trend_score: 0, posts: new Set() });
    }
    const agg = byTopic.get(topic);
    agg.trend_score += decayed;
    agg.posts.add(postId);
  }

  const list = Array.from(byTopic.entries()).map(([topic, v]) => ({
    topic,
    total_posts: v.posts.size,
    trend_score: Math.round(v.trend_score * 1000) / 1000,
  }));

  list.sort((a, b) => b.trend_score - a.trend_score || b.total_posts - a.total_posts);
  return list.slice(0, limit);
}
