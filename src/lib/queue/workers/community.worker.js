import { upsertPostEmbedding } from "@/lib/community-db";
import { isCommunityConfigured } from "@/lib/community-server";
import { embedText, embeddingModelName, vectorToPgLiteral } from "@/lib/communityEmbeddings";
import { reindexAllCommunityPostTopics } from "@/lib/community-reindex-topics";
import { clearCommunityCaches, clearCommunityTrendingCache } from "@/lib/redis";

export const COMMUNITY_QUEUE_NAME = "community-jobs";
export const COMMUNITY_CONCURRENCY = 3;

export async function communityProcessor(job) {
  if (!isCommunityConfigured()) {
    throw new Error("Community database not configured");
  }

  switch (job.name) {
    case "generate-embedding":
      return handleGenerateEmbedding(job.data);
    case "reindex-topics":
      return handleReindexTopics(job.data);
    case "pre-warm-feed":
      return handlePreWarmFeed();
    case "pre-warm-trending":
      return handlePreWarmTrending();
    default:
      throw new Error(`Unknown community job: ${job.name}`);
  }
}

async function handleGenerateEmbedding({ postId, body }) {
  const vector = await embedText(body);
  await upsertPostEmbedding(postId, vectorToPgLiteral(vector), embeddingModelName());
  return { embedded: true, postId };
}

async function handleReindexTopics({ maxPosts, afterId }) {
  const result = await reindexAllCommunityPostTopics({
    maxPosts: Number.isFinite(maxPosts) ? maxPosts : 10_000,
    afterId: afterId || "",
  });

  await clearCommunityTrendingCache();
  return result;
}

async function handlePreWarmFeed() {
  await clearCommunityCaches();
  return { warmed: true };
}

async function handlePreWarmTrending() {
  await clearCommunityTrendingCache();
  return { warmed: true };
}
