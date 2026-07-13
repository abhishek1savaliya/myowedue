import { fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/adminSession";
import { bulkUpsertCommunityUsernamesInAlgolia } from "@/lib/community-algolia";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { isCommunityConfigured } from "@/lib/community-server";
import { listAllUsernamesForReindex } from "@/lib/community-db";

const PAGE_SIZE = 1000;

/**
 * Reindex all community usernames into Algolia.
 * Superadmin only.
 */
export async function POST() {
  const { admin, error } = await requireAdmin();
  if (error) return error;
  if (admin.role !== "superadmin") return fail("Forbidden", 403);

  if (!isCommunityConfigured()) return fail("Community is not configured.", 503);
  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  let indexed = 0;
  let scanned = 0;

  try {
    const allRows = await listAllUsernamesForReindex();
    for (let from = 0; from < allRows.length; from += PAGE_SIZE) {
      const rows = allRows.slice(from, from + PAGE_SIZE);
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
    }
  } catch (qErr) {
    const message = qErr instanceof Error ? qErr.message : String(qErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Failed to load usernames", 500);
  }

  return ok({
    message: "Algolia username reindex complete.",
    indexed,
    scanned,
  });
}
