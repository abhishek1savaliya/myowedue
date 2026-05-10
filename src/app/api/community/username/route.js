import { fail, ok } from "@/lib/api";
import { normalizeCommunityUsername } from "@/lib/community-usernames";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { clearCommunityCaches } from "@/lib/redis";
import { requireUser } from "@/lib/session";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";

export async function GET(request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  if (!isSupabaseCommunityConfigured()) {
    return ok({ username: null, configured: false });
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const supabase = getSupabaseAdmin();
  if (!supabase) return ok({ username: null, configured: false });

  const uid = String(user._id);
  const { data, error: qErr } = await supabase.from("community_usernames").select("username").eq("user_id", uid).maybeSingle();

  if (qErr) {
    const mapped = mapCommunitySupabaseError(qErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(qErr.message || "Failed to load username", 500);
  }

  return ok({ username: data?.username ?? null, configured: true });
}

export async function PUT(request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  if (!isSupabaseCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  const supabase = getSupabaseAdmin();
  if (!supabase) return fail("Community database is not configured.", 503);

  let raw = "";
  try {
    const json = await request.json();
    raw = String(json.username ?? json.handle ?? "").trim();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  let normalized;
  try {
    normalized = normalizeCommunityUsername(raw);
  } catch (e) {
    return fail(e.message || "Invalid username", 422);
  }

  const uid = String(user._id);
  const now = new Date().toISOString();

  const { error: upsertErr } = await supabase.from("community_usernames").upsert(
    {
      user_id: uid,
      username: normalized,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  if (upsertErr) {
    const msg = String(upsertErr.message || "").toLowerCase();
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return fail("That username is already taken.", 409);
    }
    const mapped = mapCommunitySupabaseError(upsertErr.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(upsertErr.message || "Failed to save username", 500);
  }

  await connectDB();
  await User.updateOne({ _id: user._id }, { $set: { communityUsernamePromptSent: true } }).catch(() => {});

  await clearCommunityCaches();

  return ok({ username: normalized, message: "Username saved" });
}
