import { fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/adminSession";
import { bulkUpsertCommunityUsernamesInAlgolia } from "@/lib/community-algolia";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";

const PAGE_SIZE = 1000;

/**
 * Reindex all community usernames into Algolia.
 * Superadmin only.
 */
export async function POST() {
  const { admin, error } = await requireAdmin();
  if (error) return error;
  if (admin.role !== "superadmin") return fail("Forbidden", 403);

  if (!isSupabaseCommunityConfigured()) return fail("Community is not configured.", 503);
  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const supabase = getSupabaseAdmin();
  if (!supabase) return fail("Community is not configured.", 503);

  let from = 0;
  let indexed = 0;
  let scanned = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error: qErr } = await supabase
      .from("community_usernames")
      .select("user_id, username")
      .range(from, to);
    if (qErr) {
      const mapped = mapCommunitySupabaseError(qErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(qErr.message || "Failed to load usernames", 500);
    }

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) break;

    const payload = rows.map((r) => ({
      userId: String(r.user_id || "").trim(),
      username: String(r.username || "").trim().toLowerCase(),
    }));
    scanned += payload.length;

    const res = await bulkUpsertCommunityUsernamesInAlgolia(payload);
    if (!res.ok) {
      return fail("Failed to write usernames to Algolia index.", 500);
    }
    indexed += res.indexed;

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return ok({
    message: "Algolia username reindex complete.",
    indexed,
    scanned,
  });
}

