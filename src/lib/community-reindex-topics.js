import { deletePostTopics, insertPostTopics, listPostsForReindex } from "@/lib/community-db";
import { extractPostTopics } from "@/lib/post-topic-extraction";

const BATCH = 120;

/**
 * Rebuild post_topics for every community post using the current extractor (multi-language).
 * @param {{ maxPosts?: number; afterId?: string }} [opts]
 * @returns {Promise<{ postsProcessed: number; truncated: boolean; lastProcessedId: string }>}
 */
export async function reindexAllCommunityPostTopics(opts = {}) {
  const maxPosts = Math.min(Math.max(Number(opts.maxPosts) || 10_000, 1), 50_000);
  let lastId = opts.afterId ? String(opts.afterId) : "";
  let postsProcessed = 0;
  let truncated = false;
  let lastProcessedId = "";

  for (;;) {
    if (postsProcessed >= maxPosts) {
      truncated = true;
      break;
    }

    const posts = await listPostsForReindex({ afterId: lastId, limit: BATCH });
    if (!posts?.length) break;

    for (const p of posts) {
      if (postsProcessed >= maxPosts) {
        truncated = true;
        break;
      }
      const postId = p.id;
      const body = String(p.body || "");

      try {
        await deletePostTopics(postId);
      } catch (delErr) {
        const msg = String(delErr?.message || "").toLowerCase();
        const missing = msg.includes("post_topics") && (msg.includes("does not exist") || msg.includes("schema"));
        if (!missing) console.warn("[community-reindex] post_topics delete:", delErr?.message);
      }

      const topics = extractPostTopics(body);
      if (topics.length > 0) {
        const rows = topics.map((topic) => ({ post_id: postId, topic }));
        try {
          await insertPostTopics(rows);
        } catch (insErr) {
          const msg = String(insErr?.message || "").toLowerCase();
          const missing = msg.includes("post_topics") && (msg.includes("does not exist") || msg.includes("schema"));
          if (!missing) console.warn("[community-reindex] post_topics insert:", insErr?.message);
        }
      }

      postsProcessed += 1;
      lastId = postId;
      lastProcessedId = postId;
    }

    if (truncated) break;
    if (posts.length < BATCH) break;
  }

  return { postsProcessed, truncated, lastProcessedId };
}
