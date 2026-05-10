import { cosineSimilarity } from "@/lib/communityEmbeddings";

function clamp0to100(n) {
  return Math.max(0, Math.min(100, Number(n || 0)));
}

/**
 * Blend Phase 1 ranking with embedding + online behavior signals.
 */
export function rerankWithPhase2({
  phase1Posts,
  phase1ScoresByPostId,
  postEmbeddingsById,
  userEmbedding,
  signalsByPostId,
  pageSize,
}) {
  const scored = (phase1Posts || []).map((p) => {
    const phase1 = clamp0to100(phase1ScoresByPostId?.get?.(p.id) ?? 50);
    const emb = postEmbeddingsById?.get?.(p.id);
    const semantic = userEmbedding && emb ? clamp0to100(((cosineSimilarity(userEmbedding, emb) + 1) / 2) * 100) : 0;
    const signal = clamp0to100(signalsByPostId?.get?.(p.id) ?? 0);
    const phase2 = phase1 * 0.6 + semantic * 0.25 + signal * 0.15;
    return { post: p, phase2 };
  });
  return scored
    .sort((a, b) => b.phase2 - a.phase2)
    .slice(0, pageSize || 10)
    .map((x) => x.post);
}

export function buildSignalsScoreMap(rows) {
  const byPost = new Map();
  for (const r of rows || []) {
    const pid = String(r.post_id || "");
    if (!pid) continue;
    const watch = Math.min(40, (Number(r.watch_time_ms || 0) / 1000) * 0.8);
    const scroll = Math.min(25, (Number(r.scroll_duration_ms || 0) / 1000) * 0.5);
    const dwell = Math.min(20, (Number(r.dwell_ms || 0) / 1000) * 0.6);
    const eventBoost =
      r.event_type === "save"
        ? 30
        : r.event_type === "share"
          ? 22
          : r.event_type === "comment"
            ? 16
            : r.event_type === "like"
              ? 12
              : r.event_type === "open"
                ? 8
                : 3;
    const s = Math.min(100, watch + scroll + dwell + eventBoost);
    byPost.set(pid, Math.min(100, (byPost.get(pid) || 0) + s));
  }
  return byPost;
}

