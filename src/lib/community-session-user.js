import "server-only";
import { safeUser } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";

/** Session user for community layout hydration (matches GET /api/auth/me shape). */
export async function getCommunitySessionUser() {
  const user = await getSessionUser();
  if (!user) return null;

  const base = safeUser(user);
  let communityUsername = null;
  if (isSupabaseCommunityConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data } = await supabase
        .from("community_usernames")
        .select("username")
        .eq("user_id", String(base.id))
        .maybeSingle();
      communityUsername = data?.username ?? null;
    }
  }

  return { ...base, communityUsername };
}
