import { createHash, timingSafeEqual } from "crypto";
import { fail, ok } from "@/lib/api";
import { reindexAllCommunityPostTopics } from "@/lib/community-reindex-topics";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { clearCommunityTrendingCache } from "@/lib/redis";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";
import { enqueueCommunityJob } from "@/lib/queue/producers";

export const runtime = "nodejs";
export const maxDuration = 120;

function verifyRevalidateSecret(provided) {
  const expected = process.env.COMMUNITY_CACHE_REVALIDATE_SECRET;
  if (!expected || typeof provided !== "string" || provided.length < 8) return false;
  try {
    const a = createHash("sha256").update(provided, "utf8").digest();
    const b = createHash("sha256").update(expected, "utf8").digest();
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * POST — bust Redis trending cache; optional body `{ "reindex": true }` rebuilds post_topics for all posts
 * (multi-language extractor). Requires header `x-owd-revalidate-secret` matching COMMUNITY_CACHE_REVALIDATE_SECRET.
 */
export async function POST(request) {
  const expected = process.env.COMMUNITY_CACHE_REVALIDATE_SECRET;
  if (!expected) {
    return fail("Set COMMUNITY_CACHE_REVALIDATE_SECRET to use this endpoint.", 503);
  }

  const headerSecret = request.headers.get("x-owd-revalidate-secret");
  if (!verifyRevalidateSecret(headerSecret || "")) {
    return fail("Unauthorized", 401);
  }

  if (!isSupabaseCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const supabase = getSupabaseAdmin();
  if (!supabase) return fail("Community database is not configured.", 503);

  let reindex = false;
  let maxPosts = 10_000;
  let afterId = "";
  try {
    const json = await request.json();
    if (json && typeof json === "object") {
      if (json.reindex === true) reindex = true;
      if (json.maxPosts != null) maxPosts = Number(json.maxPosts);
      if (json.afterId != null) afterId = String(json.afterId);
    }
  } catch {
    // empty body is fine
  }

  let postsProcessed = 0;
  let truncated = false;
  let lastProcessedId = "";

  if (reindex) {
    const queued = await enqueueCommunityJob("reindex-topics", {
      maxPosts: Number.isFinite(maxPosts) ? maxPosts : 10_000,
      afterId,
    });
    if (queued) {
      return ok({
        trendingCacheCleared: false,
        reindex: true,
        queued: true,
        postsProcessed: 0,
        truncated: false,
        lastProcessedId: "",
      });
    }

    try {
      const result = await reindexAllCommunityPostTopics(supabase, {
        maxPosts: Number.isFinite(maxPosts) ? maxPosts : 10_000,
        afterId,
      });
      postsProcessed = result.postsProcessed;
      truncated = result.truncated;
      lastProcessedId = result.lastProcessedId || "";
    } catch (e) {
      const msg = String(e?.message || e);
      const mapped = mapCommunitySupabaseError(msg, setup);
      if (mapped) return fail(mapped, 503);
      return fail(msg || "Reindex failed", 500);
    }
  }

  const cleared = await clearCommunityTrendingCache();

  return ok({
    trendingCacheCleared: cleared,
    reindex,
    postsProcessed,
    truncated,
    lastProcessedId: truncated ? lastProcessedId : "",
  });
}
