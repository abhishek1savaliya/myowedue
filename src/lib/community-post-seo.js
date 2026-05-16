import { revalidatePath } from "next/cache";
import { deriveCommunityPostSeoFields } from "@/lib/community-seo";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";

export { deriveCommunityPostSeoFields };

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} postId
 * @param {{ body?: string; author_name?: string }} post
 */
export async function persistCommunityPostSeo(supabase, postId, post) {
  if (!supabase || !postId || !post) return { ok: false, skipped: true };
  const fields = deriveCommunityPostSeoFields(post);
  const { error } = await supabase.from("community_posts").update(fields).eq("id", postId);
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("seo_title") || msg.includes("seo_description") || msg.includes("seo_keywords")) {
      return { ok: false, skipped: true };
    }
    console.warn("[community-seo] persist failed:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, fields };
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
  const supabase = getSupabaseAdmin();
  if (!supabase) return { updated: 0 };

  const { data, error } = await supabase
    .from("community_posts")
    .select("id, author_name, body, seo_title")
    .is("seo_title", null)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error || !Array.isArray(data) || data.length === 0) {
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
