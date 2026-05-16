import { requireAdmin } from "@/lib/adminSession";
import { ok, fail } from "@/lib/api";
import { getCachedOrCompute } from "@/lib/adminApiCache";
import { buildPremiumAdminInsights } from "@/lib/premium-funnel";

const PREMIUM_STATS_TTL_MS = 30 * 1000;

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  if (admin.role !== "superadmin") {
    return fail("Forbidden", 403);
  }

  try {
    const payload = await getCachedOrCompute("admin:stats:premium", PREMIUM_STATS_TTL_MS, () =>
      buildPremiumAdminInsights()
    );
    return ok(payload);
  } catch (err) {
    console.error("Admin premium stats error:", err);
    return fail("Internal server error", 500);
  }
}
