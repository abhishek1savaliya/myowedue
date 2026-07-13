import "server-only";
import { safeUser } from "@/lib/auth";
import { findUsernameByUserId } from "@/lib/community-db";
import { isCommunityConfigured } from "@/lib/community-server";
import { getSessionUser } from "@/lib/session";

/** Session user for community layout hydration (matches GET /api/auth/me shape). */
export async function getCommunitySessionUser() {
  const user = await getSessionUser();
  if (!user) return null;

  const base = safeUser(user);
  let communityUsername = null;
  if (isCommunityConfigured()) {
    try {
      const row = await findUsernameByUserId(String(base.id));
      communityUsername = row?.username ?? null;
    } catch {
      // ignore lookup errors
    }
  }

  return { ...base, communityUsername };
}
