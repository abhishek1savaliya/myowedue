import { revalidatePath } from "next/cache";
import { deriveCommunityPostSeoFields } from "@/lib/community-seo";
import {
  hasSeoColumns,
  listPostsMissingSeo,
  updatePostSeo,
  updatePostSeoWithoutKeywords,
} from "@/lib/community-db";
import { ensureCommunityPostgresSchema, isCommunityConfigured } from "@/lib/community-server";

export { deriveCommunityPostSeoFields };

let seoColumnsReady = null;

function isSeoPersistSkippableError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("seo_title") ||
    msg.includes("seo_description") ||
    msg.includes("seo_keywords") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("empty or invalid json") ||
    msg.includes("invalid json")
  );
}

function buildSeoUpdatePayload(post) {
  const fields = deriveCommunityPostSeoFields(post);
  const seo_title = String(fields.seo_title || "").trim().slice(0, 500) || null;
  const seo_description = String(fields.seo_description || "").trim().slice(0, 1000) || null;
  const seo_keywords = (Array.isArray(fields.seo_keywords) ? fields.seo_keywords : [])
    .map((k) => String(k || "").trim())
    .filter((k) => k.length > 0 && k.length <= 64)
    .slice(0, 15);
  return { seo_title, seo_description, seo_keywords };
}

/** Ensure migration 011 SEO columns exist (needs COMMUNITY_DATABASE_URL for auto-DDL). */
export async function ensureCommunityPostSeoReady() {
  if (seoColumnsReady !== null) return seoColumnsReady;
  if (!isCommunityConfigured()) {
    seoColumnsReady = false;
    return false;
  }

  await ensureCommunityPostgresSchema().catch(() => {});

  try {
    seoColumnsReady = await hasSeoColumns();
  } catch {
    seoColumnsReady = false;
  }
  return seoColumnsReady;
}

/**
 * @param {string} postId
 * @param {{ body?: string; author_name?: string }} post
 */
export async function persistCommunityPostSeo(postId, post) {
  if (!postId || !post) return { ok: false, skipped: true };
  if (!(await ensureCommunityPostSeoReady())) return { ok: false, skipped: true };

  const payload = buildSeoUpdatePayload(post);

  try {
    await updatePostSeo(postId, payload);
  } catch (error) {
    if (payload.seo_keywords.length > 0 && isSeoPersistSkippableError(error)) {
      const { seo_keywords: _kw, ...withoutKeywords } = payload;
      try {
        await updatePostSeoWithoutKeywords(postId, withoutKeywords);
      } catch (retryErr) {
        if (isSeoPersistSkippableError(retryErr)) {
          return { ok: false, skipped: true };
        }
        console.warn("[community-seo] persist failed:", retryErr?.message);
        return { ok: false, error: retryErr?.message };
      }
    } else if (isSeoPersistSkippableError(error)) {
      return { ok: false, skipped: true };
    } else {
      console.warn("[community-seo] persist failed:", error?.message);
      return { ok: false, error: error?.message };
    }
  }
  return { ok: true, fields: payload };
}

/** Invalidate cached HTML/metadata for a post and listings. */
export function revalidateCommunityPostSeo(postId) {
  try {
    revalidatePath("/community");
    revalidatePath("/community/trending");
    if (postId) revalidatePath(`/community/post/${postId}`);
    revalidatePath("/sitemap.xml");
    revalidatePath("/community/posts.xml");
  } catch {
    // revalidatePath may be unavailable outside request context
  }
}

/**
 * Gradually backfill SEO columns for older posts (e.g. from sitemap generation).
 * @param {number} [limit]
 */
export async function backfillCommunityPostSeoBatch(limit = 30) {
  if (!isCommunityConfigured()) return { updated: 0 };
  if (!(await ensureCommunityPostSeoReady())) return { updated: 0, skipped: true };

  let data;
  try {
    data = await listPostsMissingSeo(Math.min(Math.max(limit, 1), 100));
  } catch (error) {
    if (isSeoPersistSkippableError(error)) return { updated: 0, skipped: true };
    console.warn("[community-seo] backfill query failed:", error?.message);
    return { updated: 0 };
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { updated: 0 };
  }

  let updated = 0;
  for (const row of data) {
    const result = await persistCommunityPostSeo(row.id, row);
    if (result.ok) updated += 1;
    else if (result.skipped) break;
  }
  return { updated };
}
