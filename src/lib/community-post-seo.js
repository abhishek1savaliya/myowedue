import { revalidatePath } from "next/cache";
import { deriveCommunityPostSeoFields } from "@/lib/community-seo";
import {
  ensureCommunityPostgresSchema,
  getSupabaseAdmin,
  isSupabaseCommunityConfigured,
} from "@/lib/supabase-server";

export { deriveCommunityPostSeoFields };

let seoColumnsReady = null;

function isSeoPersistSkippableError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  return (
    msg.includes("seo_title") ||
    msg.includes("seo_description") ||
    msg.includes("seo_keywords") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("empty or invalid json") ||
    msg.includes("invalid json") ||
    code === "pgrst102" ||
    code === "pgrst204"
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

/** Ensure migration 011 SEO columns exist (needs SUPABASE_DATABASE_URL for auto-DDL). */
export async function ensureCommunityPostSeoReady() {
  if (seoColumnsReady !== null) return seoColumnsReady;
  if (!isSupabaseCommunityConfigured()) {
    seoColumnsReady = false;
    return false;
  }

  await ensureCommunityPostgresSchema().catch(() => {});

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    seoColumnsReady = false;
    return false;
  }

  const { error } = await supabase.from("community_posts").select("seo_title").limit(1);
  if (error) {
    seoColumnsReady = false;
    return false;
  }

  seoColumnsReady = true;
  return true;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} postId
 * @param {{ body?: string; author_name?: string }} post
 */
export async function persistCommunityPostSeo(supabase, postId, post) {
  if (!supabase || !postId || !post) return { ok: false, skipped: true };
  if (!(await ensureCommunityPostSeoReady())) return { ok: false, skipped: true };

  const payload = buildSeoUpdatePayload(post);

  let { error } = await supabase.from("community_posts").update(payload).eq("id", postId);
  if (error && payload.seo_keywords.length > 0 && isSeoPersistSkippableError(error)) {
    const { seo_keywords: _kw, ...withoutKeywords } = payload;
    ({ error } = await supabase.from("community_posts").update(withoutKeywords).eq("id", postId));
  }

  if (error) {
    if (isSeoPersistSkippableError(error)) {
      return { ok: false, skipped: true };
    }
    console.warn("[community-seo] persist failed:", error.message);
    return { ok: false, error: error.message };
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
  if (!isSupabaseCommunityConfigured()) return { updated: 0 };
  if (!(await ensureCommunityPostSeoReady())) return { updated: 0, skipped: true };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { updated: 0 };

  const { data, error } = await supabase
    .from("community_posts")
    .select("id, author_name, body, seo_title")
    .is("seo_title", null)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error) {
    if (isSeoPersistSkippableError(error)) return { updated: 0, skipped: true };
    console.warn("[community-seo] backfill query failed:", error.message);
    return { updated: 0 };
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { updated: 0 };
  }

  let updated = 0;
  for (const row of data) {
    const result = await persistCommunityPostSeo(supabase, row.id, row);
    if (result.ok) updated += 1;
    else if (result.skipped) break;
  }
  return { updated };
}
