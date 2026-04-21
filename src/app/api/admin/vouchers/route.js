import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/adminSession";
import SubscriptionVoucher from "@/models/SubscriptionVoucher";

function buildVoucherCode(plan) {
  const prefix = plan === "pro_monthly" ? "PROM" : "PROM";
  return `${prefix}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  if (!["superadmin", "manager"].includes(admin.role)) {
    return fail("Forbidden", 403);
  }

  try {
    await connectDB();
    const vouchers = await SubscriptionVoucher.find()
      .sort({ createdAt: -1 })
      .lean();

    return ok({
      vouchers: vouchers.map((voucher) => ({
        id: voucher._id.toString(),
        code: voucher.code,
        plan: voucher.plan,
        durationDays: voucher.durationDays,
        maxRedemptions: voucher.maxRedemptions,
        redemptionCount: voucher.redemptionCount,
        isActive: voucher.isActive,
        notes: voucher.notes || "",
        expiresAt: voucher.expiresAt,
        generatedByAdminName: voucher.generatedByAdminName || "",
        createdAt: voucher.createdAt,
      })),
    });
  } catch (caughtError) {
    console.error("Admin vouchers GET error:", caughtError);
    return fail("Failed to load vouchers", 500);
  }
}

export async function POST(request) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  if (!["superadmin", "manager"].includes(admin.role)) {
    return fail("Forbidden", 403);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const plan = "pro_monthly";
    const durationDays = Number.parseInt(String(body.durationDays || 30), 10);
    const maxRedemptions = Math.max(1, Number.parseInt(String(body.maxRedemptions || 1), 10) || 1);
    const notes = String(body.notes || "").trim();
    const requestedCode = String(body.code || "").trim().toUpperCase();
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    if (!durationDays || durationDays < 1) return fail("Duration must be at least 1 day", 422);

    await connectDB();

    let code = requestedCode || buildVoucherCode(plan);
    const existing = await SubscriptionVoucher.findOne({ code });
    if (existing) {
      if (requestedCode) {
        return fail("Voucher code already exists", 409);
      }
      code = `${code}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    }

    const voucher = await SubscriptionVoucher.create({
      code,
      plan,
      durationDays,
      maxRedemptions,
      notes,
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
      generatedByAdminId: admin._id,
      generatedByAdminName: admin.name,
    });

    return ok({
      voucher: {
        id: voucher._id.toString(),
        code: voucher.code,
        plan: voucher.plan,
        durationDays: voucher.durationDays,
        maxRedemptions: voucher.maxRedemptions,
        redemptionCount: voucher.redemptionCount,
        isActive: voucher.isActive,
        notes: voucher.notes || "",
        expiresAt: voucher.expiresAt,
        generatedByAdminName: voucher.generatedByAdminName || "",
        createdAt: voucher.createdAt,
      },
      message: "Voucher created successfully",
    }, 201);
  } catch (caughtError) {
    console.error("Admin vouchers POST error:", caughtError);
    return fail("Failed to create voucher", 500);
  }
}
