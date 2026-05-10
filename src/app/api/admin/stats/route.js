import { requireAdmin } from "@/lib/adminSession";
import { ok, fail } from "@/lib/api";
import { buildSuperadminStatsBundle } from "@/lib/buildSuperadminStatsBundle";
import { getCachedOrCompute } from "@/lib/adminApiCache";

const ADMIN_STATS_TTL_MS = 30 * 1000;

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  if (admin.role !== "superadmin") {
    return fail("Forbidden", 403);
  }

  try {
    const payload = await getCachedOrCompute("admin:stats:superadmin", ADMIN_STATS_TTL_MS, buildSuperadminStatsBundle);
    return ok(payload);
  } catch (err) {
    console.error("Admin stats error:", err);
    return fail("Internal server error", 500);
  }
}
