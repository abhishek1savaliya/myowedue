import { fail, ok } from "@/lib/api";
import { assertCommunityHandleAvailable } from "@/lib/community-handle-availability";
import { COMMUNITY_USERNAME_MAX, COMMUNITY_USERNAME_MIN, normalizeCommunityUsername } from "@/lib/community-usernames";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { upsertCommunityUsernameInAlgolia } from "@/lib/community-algolia";
import { clearCommunityCaches } from "@/lib/redis";
import { requireUser } from "@/lib/session";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { isCommunityConfigured } from "@/lib/community-server";
import { findUsernameByUserId, isCommunityDbConfigured, upsertUsername } from "@/lib/community-db";

export async function GET(request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  if (!isCommunityConfigured()) {
    return ok({ username: null, configured: false });
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  if (!isCommunityDbConfigured()) {
    return ok({ username: null, configured: false });
  }

  const uid = String(user._id);
  try {
    const data = await findUsernameByUserId(uid);
    return ok({ username: data?.username ?? null, configured: true });
  } catch (qErr) {
    const message = qErr instanceof Error ? qErr.message : String(qErr);
    const mapped = mapCommunitySupabaseError(message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(message || "Failed to load username", 500);
  }
}

export async function PUT(request) {
  const { user, error } = await requireUser(request);
  if (error) return error;

  if (!isCommunityConfigured()) {
    return fail("Community database is not configured.", 503);
  }

  const { setup, fail503 } = await prepareCommunityApi();
  if (fail503) return fail(fail503, 503);

  if (!isCommunityDbConfigured()) {
    return fail("Community database is not configured.", 503);
  }

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

  const conflict = await assertCommunityHandleAvailable(normalized, uid);
  if (conflict) return fail(conflict, 409);

  try {
    await upsertUsername(uid, normalized);
  } catch (upsertErr) {
    const msg = String(upsertErr?.message || "").toLowerCase();
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return fail("That username is already taken.", 409);
    }
    if (
      msg.includes("community_username_format") ||
      msg.includes("check constraint") ||
      msg.includes("violates check constraint")
    ) {
      return fail(
        `This username is not allowed by the database (length ${COMMUNITY_USERNAME_MIN}–${COMMUNITY_USERNAME_MAX}, a–z, 0–9, _). If you recently raised the limit, run the latest community migration for community_usernames.`,
        422
      );
    }
    const mapped = mapCommunitySupabaseError(upsertErr?.message, setup);
    if (mapped) return fail(mapped, 503);
    return fail(upsertErr?.message || "Failed to save username", 500);
  }

  await connectDB();
  await User.updateOne({ _id: user._id }, { $set: { communityUsernamePromptSent: true } }).catch(() => {});

  await clearCommunityCaches();
  void upsertCommunityUsernameInAlgolia({ userId: uid, username: normalized });

  return ok({ username: normalized, message: "Username saved" });
}
