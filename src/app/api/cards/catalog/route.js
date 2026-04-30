import { connectDB } from "@/lib/db";
import { ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { ensureCardCatalog, serializeCardCatalog } from "@/lib/cardCatalog";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  await connectDB();
  const catalog = await ensureCardCatalog();
  return ok({ catalog: serializeCardCatalog(catalog) });
}
