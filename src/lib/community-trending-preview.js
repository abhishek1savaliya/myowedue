/**
 * Free users see only the middle two topics from a ranked trending list.
 * @param {Array<{ topic: string; total_posts: number; trend_score: number }>} topics
 * @param {number} [limit]
 */
export function getTrendingDisplayForUser(topics, limit = 10, { isPremium = false } = {}) {
  const full = (Array.isArray(topics) ? topics : []).slice(0, limit);
  if (isPremium || full.length <= 2) {
    return {
      rows: full,
      rankOffset: 0,
      totalCount: full.length,
      isPreview: false,
    };
  }

  const start = Math.floor((full.length - 2) / 2);
  return {
    rows: full.slice(start, start + 2),
    rankOffset: start,
    totalCount: full.length,
    isPreview: true,
    hiddenCount: Math.max(0, full.length - 2),
  };
}
