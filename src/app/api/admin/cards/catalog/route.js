import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/adminSession";
import CardCatalog from "@/models/CardCatalog";
import { ensureCardCatalog, normalizeCardCatalog, serializeCardCatalog } from "@/lib/cardCatalog";

function canManageCatalog(role) {
  return ["superadmin", "manager"].includes(role);
}

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error) return error;
  if (!canManageCatalog(admin.role)) return fail("Forbidden", 403);

  await connectDB();
  const catalog = await ensureCardCatalog();
  return ok({
    catalog: serializeCardCatalog(catalog),
    updatedByAdminName: catalog.updatedByAdminName || "",
    updatedAt: catalog.updatedAt,
  });
}

export async function PUT(request) {
  const { admin, error } = await requireAdmin();
  if (error) return error;
  if (!canManageCatalog(admin.role)) return fail("Forbidden", 403);

  try {
    const body = await request.json().catch(() => ({}));
    const input = body.catalog && typeof body.catalog === "object" ? body.catalog : body;
    const normalized = normalizeCardCatalog(input);

    await connectDB();
    const catalog = await CardCatalog.findOneAndUpdate(
      { key: "default" },
      {
        $set: {
          ...normalized,
          updatedByAdminId: admin._id,
          updatedByAdminName: admin.name,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return ok({
      catalog: serializeCardCatalog(catalog),
      message: "Card catalog updated successfully",
      updatedByAdminName: catalog.updatedByAdminName || "",
      updatedAt: catalog.updatedAt,
    });
  } catch (caughtError) {
    return fail(caughtError?.message || "Failed to update card catalog", 422);
  }
}
