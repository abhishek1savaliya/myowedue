import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/adminSession";
import { fail, ok } from "@/lib/api";
import PasswordResetRequest from "@/models/PasswordResetRequest";
import { serializePasswordResetRequest } from "@/lib/password-reset";

export async function GET(req) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    await connectDB();

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = 20;

    const filter = {};
    if (status && status !== "all") {
      filter.status = status;
    } else if (!status) {
      filter.status = { $in: ["pending", "issued"] };
    }

    const [total, rows] = await Promise.all([
      PasswordResetRequest.countDocuments(filter),
      PasswordResetRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("issuedBy", "name email")
        .lean(),
    ]);

    return ok({
      requests: rows.map((row) => serializePasswordResetRequest(row)),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error("Admin password resets list error:", err);
    return fail("Failed to load password reset requests", 500);
  }
}
