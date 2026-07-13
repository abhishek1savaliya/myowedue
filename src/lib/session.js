import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import UserSession from "@/models/UserSession";

/** Fallback when `cookies()` and the incoming Request diverge (some Route Handler + fetch combinations). */
function sessionTokenFromCookieHeader(header) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const entry = part.trim();
    if (entry.startsWith("session_token=")) {
      return decodeURIComponent(entry.slice("session_token=".length));
    }
  }
  return null;
}

export async function getSessionUser(request) {
  const store = await cookies();
  let token = store.get("session_token")?.value;
  if (!token && request?.headers?.get) {
    token = sessionTokenFromCookieHeader(request.headers.get("cookie"));
  }

  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;

  try {
    await connectDB();
    if (decoded?.sessionId) {
      const session = await UserSession.findOne({
        userId: decoded.userId,
        sessionId: String(decoded.sessionId),
        status: "active",
      }).select("_id");
      if (!session) return null;

      UserSession.updateOne(
        { userId: decoded.userId, sessionId: String(decoded.sessionId), status: "active" },
        { $set: { lastSeenAt: new Date() } }
      ).catch(() => {});
    }

    const user = await User.findById(decoded.userId);
    if (!user) return null;

    return user;
  } catch (error) {
    console.error("[session] database unavailable:", error?.message || error);
    return null;
  }
}

export async function requireUser(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return {
      error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
      user: null,
    };
  }

  return { error: null, user };
}

export function extractClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const forwarded = forwardedFor.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip") || "";
  return String(forwarded || realIp || "").slice(0, 96);
}

export function formatIpForDisplay(ip) {
  const value = String(ip || "").trim();
  if (!value) return "Unknown";
  if (value === "::1") return "127.0.0.1";
  return value;
}

export async function enforceConcurrentSessionLimit(userId, limit) {
  const boundedLimit = Math.min(5, Math.max(1, Number(limit || 1)));
  const sessions = await UserSession.find({ userId, status: "active" })
    .sort({ createdAt: -1 })
    .select("_id sessionId")
    .lean();

  if (sessions.length <= boundedLimit) return [];
  const sessionsToRevoke = sessions.slice(boundedLimit);
  const revokedSessionIds = sessionsToRevoke.map((session) => session.sessionId);

  await UserSession.updateMany(
    { _id: { $in: sessionsToRevoke.map((session) => session._id) } },
    {
      $set: {
        status: "revoked",
        revokedAt: new Date(),
        revokeReason: "concurrent_limit_exceeded",
      },
    }
  );

  return revokedSessionIds;
}
