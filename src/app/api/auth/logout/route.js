import { ok } from "@/lib/api";

export async function POST() {
  const res = ok({ message: "Logged out" });
  res.cookies.set("session_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
