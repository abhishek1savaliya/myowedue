import { NextResponse } from "next/server";
import ActivityLog from "@/models/ActivityLog";

export function ok(data = {}, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message, status = 400) {
  return NextResponse.json({ message }, { status });
}

export async function logActivity(userId, action, detail = "", meta = {}) {
  try {
    await ActivityLog.create({ userId, action, detail, meta });
  } catch {
    // Avoid breaking request flow on non-critical log writes.
  }
}
