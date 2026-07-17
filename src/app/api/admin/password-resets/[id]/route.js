import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/adminSession";
import { fail, ok } from "@/lib/api";
import { issuePasswordResetLink, serializePasswordResetRequest } from "@/lib/password-reset";
import PasswordResetRequest from "@/models/PasswordResetRequest";

export async function POST(_req, { params }) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    await connectDB();
    const result = await issuePasswordResetLink(id, admin._id);

    if (!result.ok) {
      return fail(result.message, result.status);
    }

    return ok({
      message: result.message,
      reset: result.reset,
    });
  } catch (err) {
    console.error("Issue password reset error:", err);
    return fail("Failed to create reset link", 500);
  }
}

export async function PATCH(req, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const nextStatus = String(body.status || "").trim();

    if (!["cancelled"].includes(nextStatus)) {
      return fail("Only cancellation is supported", 422);
    }

    await connectDB();
    const request = await PasswordResetRequest.findById(id);
    if (!request) return fail("Request not found", 404);

    if (request.status === "used") {
      return fail("Used requests cannot be cancelled", 400);
    }

    request.status = "cancelled";
    request.codeHash = null;
    await request.save();

    return ok({
      message: "Request cancelled",
      request: serializePasswordResetRequest(request),
    });
  } catch (err) {
    console.error("Cancel password reset error:", err);
    return fail("Failed to update request", 500);
  }
}
