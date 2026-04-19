import { ok } from "@/lib/api";
import { cookies } from "next/headers";

export async function POST() {
  const store = await cookies();
  store.delete("admin_session_token");
  return ok({ message: "Logged out" });
}
