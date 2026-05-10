import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Notification from "@/models/Notification";
import { upsertCommunityUsernameInAlgolia } from "@/lib/community-algolia";
import { hashPassword, safeUser, signToken } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { randomUUID } from "crypto";
import UserSession from "@/models/UserSession";
import { enforceConcurrentSessionLimit, extractClientIp } from "@/lib/session";
import { normalizeCommunityUsername } from "@/lib/community-usernames";
import { mapCommunitySupabaseError, prepareCommunityApi } from "@/lib/community-api-setup";
import { getSupabaseAdmin, isSupabaseCommunityConfigured } from "@/lib/supabase-server";

export async function POST(request) {
  try {
    const { firstName, lastName, email, password, phone, communityUsername } = await request.json();
    const normalizedFirst = String(firstName || "").trim();
    const normalizedLast = String(lastName || "").trim();
    const fullName = `${normalizedFirst} ${normalizedLast}`.trim();

    if (!normalizedFirst || !normalizedLast || !email || !password || password.length < 6) {
      return fail("First name, last name, email and password (min 6 chars) are required", 422);
    }

    if (!String(communityUsername || "").trim()) {
      return fail("Community @username is required.", 422);
    }

    let normalizedHandle;
    try {
      normalizedHandle = normalizeCommunityUsername(communityUsername);
    } catch (e) {
      return fail(e?.message || "Invalid community username.", 422);
    }

    if (!isSupabaseCommunityConfigured()) {
      return fail("New accounts require community services to be configured. Please try again later.", 503);
    }

    const { setup, fail503 } = await prepareCommunityApi();
    if (fail503) return fail(fail503, 503);

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return fail("Community database is not available. Please try again later.", 503);
    }

    const { data: takenRow, error: takenErr } = await supabase
      .from("community_usernames")
      .select("user_id")
      .eq("username", normalizedHandle)
      .maybeSingle();

    if (takenErr) {
      const mapped = mapCommunitySupabaseError(takenErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(takenErr.message || "Could not verify username.", 500);
    }
    if (takenRow) {
      return fail("That community username is already taken.", 409);
    }

    await connectDB();
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return fail("Email already registered", 409);

    const user = await User.create({
      firstName: normalizedFirst,
      lastName: normalizedLast,
      name: fullName,
      email: email.toLowerCase().trim(),
      password: await hashPassword(password),
      phone: String(phone || "").trim(),
    });

    const nowIso = new Date().toISOString();
    const { error: insErr } = await supabase.from("community_usernames").insert({
      user_id: String(user._id),
      username: normalizedHandle,
      updated_at: nowIso,
    });

    if (insErr) {
      await User.deleteOne({ _id: user._id });
      const msg = String(insErr.message || "").toLowerCase();
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return fail("That community username is already taken.", 409);
      }
      if (
        msg.includes("community_username_format") ||
        msg.includes("check constraint") ||
        msg.includes("violates check constraint")
      ) {
        return fail(insErr.message || "Username is not allowed.", 422);
      }
      const mapped = mapCommunitySupabaseError(insErr.message, setup);
      if (mapped) return fail(mapped, 503);
      return fail(insErr.message || "Failed to reserve username.", 500);
    }
    void upsertCommunityUsernameInAlgolia({ userId: String(user._id), username: normalizedHandle });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await Notification.create({
      userId: user._id,
      type: "welcome",
      title: "Welcome to MYOWEDUE",
      message: "Welcome to MYOWEDUE! I hope you will love this app.",
      meta: {},
      expiresAt,
    });

    const sessionId = randomUUID();
    const ip = extractClientIp(request);
    const userAgent = String(request.headers.get("user-agent") || "").slice(0, 240);

    await UserSession.create({
      userId: user._id,
      sessionId,
      ip,
      userAgent,
      rememberMe: true,
      status: "active",
      lastSeenAt: new Date(),
    });
    await enforceConcurrentSessionLimit(user._id, user.concurrentSessionLimit || 1);

    const token = signToken({ userId: user._id.toString(), sessionId });
    const res = ok({ user: safeUser(user), message: "Signup successful" }, 201);
    res.cookies.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (error) {
    console.error("Signup error:", error);
    const message =
      process.env.NODE_ENV === "development"
        ? error?.message || "Failed to signup"
        : "Failed to signup";
    return fail(message, 500);
  }
}
