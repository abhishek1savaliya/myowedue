import { fail, ok } from "@/lib/api";
import { searchCommunityMembers } from "@/lib/community-member-search";
import { prepareCommunityApi } from "@/lib/community-api-setup";

/** GET ?q= — find members by @handle, public alias, or display name. */
export async function GET(request) {
  const { fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const { searchParams } = new URL(request.url);
  const q = String(searchParams.get("q") ?? "").trim();
  if (q.length < 1) {
    return ok({ results: [] });
  }

  const results = await searchCommunityMembers(q, 12);
  return ok({ results });
}
