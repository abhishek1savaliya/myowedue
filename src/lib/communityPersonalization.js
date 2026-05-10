import nlp from "compromise";
import winkNLP from "wink-nlp";
import model from "wink-eng-lite-web-model";

const wink = winkNLP(model);
const { its } = wink;

const HOUR_MS = 60 * 60 * 1000;

function tokenize(text) {
  const raw = String(text || "").toLowerCase();
  const a = nlp(raw).nouns().out("array").map((x) => String(x).toLowerCase());
  const b = wink
    .readDoc(raw)
    .tokens()
    .filter((t) => t.out(its.type) === "word")
    .out(its.lemma)
    .map((x) => String(x || "").toLowerCase());
  return [...new Set([...a, ...b].filter((t) => t.length >= 3))];
}

function overlapScore(aSet, bTokens) {
  if (!aSet || aSet.size === 0 || !bTokens?.length) return 0;
  let hit = 0;
  for (const t of bTokens) if (aSet.has(t)) hit += 1;
  return Math.min(100, (hit / Math.max(1, bTokens.length)) * 100);
}

function engagementScore(likes, comments, shares) {
  const weighted = likes * 1 + comments * 2 + shares * 2.5;
  return Math.min(100, weighted * 2);
}

function recencyScore(createdAt) {
  const ageHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / HOUR_MS);
  return Math.max(0, 100 - ageHours * 4);
}

/**
 * Phase 1 ranking:
 * - 70% following
 * - 20% trending
 * - 10% recommendation
 * Formula:
 * Score=(UserInterest×40)+(Engagement×30)+(Relationship×20)+(Recency×10)
 */
export function rankPersonalizedPosts({
  candidates,
  likesMap,
  commentsMap,
  followingSet,
  userInterestTokens,
  pageSize,
}) {
  const interestSet = new Set(userInterestTokens || []);
  const scored = (candidates || []).map((p) => {
    const bodyTokens = tokenize(p.body);
    const userInterest = overlapScore(interestSet, bodyTokens);
    const engagement = engagementScore(
      likesMap.get(p.id) || 0,
      commentsMap.get(p.id) || 0,
      Number(p.share_count || 0)
    );
    const relationship = followingSet.has(String(p.author_id)) ? 100 : 20;
    const recency = recencyScore(p.created_at);
    const score = userInterest * 0.4 + engagement * 0.3 + relationship * 0.2 + recency * 0.1;
    return { post: p, score, engagement, relationship };
  });

  const followingPool = scored
    .filter((x) => followingSet.has(String(x.post.author_id)))
    .sort((a, b) => b.score - a.score);

  const trendingPool = [...scored].sort((a, b) => b.engagement - a.engagement);

  const recommendationPool = scored
    .filter((x) => !followingSet.has(String(x.post.author_id)))
    .sort((a, b) => b.score - a.score);

  const takeFollow = Math.max(1, Math.round(pageSize * 0.7));
  const takeTrending = Math.max(1, Math.round(pageSize * 0.2));
  const takeReco = Math.max(1, pageSize - takeFollow - takeTrending);

  const chosen = [];
  const used = new Set();
  function addFrom(pool, count) {
    for (const item of pool) {
      if (chosen.length >= pageSize || count <= 0) break;
      if (used.has(item.post.id)) continue;
      used.add(item.post.id);
      chosen.push(item.post);
      count -= 1;
    }
  }

  addFrom(followingPool, takeFollow);
  addFrom(trendingPool, takeTrending);
  addFrom(recommendationPool, takeReco);
  addFrom(scored.sort((a, b) => b.score - a.score), pageSize - chosen.length);

  const selected = chosen.slice(0, pageSize);
  const scoreMap = new Map(scored.map((x) => [x.post.id, x.score]));
  return { posts: selected, scoreMap };
}

