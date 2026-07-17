import "server-only";
import { hashPassword } from "@/lib/auth";
import User from "@/models/User";
import UserSession from "@/models/UserSession";
import PasswordResetRequest, {
  generatePasswordResetCode,
  generatePasswordResetLinkToken,
  hashPasswordResetCode,
  PASSWORD_RESET_LINK_TTL_MS,
} from "@/models/PasswordResetRequest";

function siteBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function buildPasswordResetUrl(linkToken) {
  return `${siteBaseUrl()}/reset-password/${encodeURIComponent(linkToken)}`;
}

export async function createPasswordResetRequest(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, status: 422, message: "Email is required" };
  }

  const user = await User.findOne({ email: normalizedEmail }).select("_id email");

  // Always acknowledge — avoid email enumeration. Only queue when the account exists.
  if (!user) {
    return {
      ok: true,
      status: 200,
      message: "If that email is registered, your request was sent to our team.",
    };
  }

  const existingPending = await PasswordResetRequest.findOne({
    email: normalizedEmail,
    status: "pending",
  }).select("_id");

  if (!existingPending) {
    await PasswordResetRequest.create({
      email: normalizedEmail,
      userId: user._id,
      status: "pending",
    });
  }

  return {
    ok: true,
    status: 200,
    message: "Your password reset request was sent to our team. An admin will contact you with a reset link.",
  };
}

export async function issuePasswordResetLink(requestId, adminId) {
  const request = await PasswordResetRequest.findById(requestId);
  if (!request) {
    return { ok: false, status: 404, message: "Request not found" };
  }

  if (request.status === "used") {
    return { ok: false, status: 400, message: "This request was already used" };
  }

  if (request.status === "cancelled") {
    return { ok: false, status: 400, message: "This request was cancelled" };
  }

  const user = await User.findOne({ email: request.email }).select("_id email name");
  if (!user) {
    return { ok: false, status: 400, message: "No user account found for this email" };
  }

  const code = generatePasswordResetCode();
  const linkToken = generatePasswordResetLinkToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_LINK_TTL_MS);

  request.userId = user._id;
  request.linkToken = linkToken;
  request.codeHash = hashPasswordResetCode(code);
  request.expiresAt = expiresAt;
  request.issuedBy = adminId;
  request.issuedAt = new Date();
  request.status = "issued";
  await request.save();

  return {
    ok: true,
    status: 200,
    message: "Reset link created. Copy the code and link and send them to the user manually.",
    reset: {
      id: request._id.toString(),
      email: request.email,
      code,
      linkToken,
      resetUrl: buildPasswordResetUrl(linkToken),
      expiresAt: expiresAt.toISOString(),
      validDays: 7,
    },
  };
}

export async function getPasswordResetLinkStatus(linkToken) {
  const token = String(linkToken || "").trim();
  if (!token) {
    return { ok: false, status: 404, message: "Invalid reset link" };
  }

  const request = await PasswordResetRequest.findOne({ linkToken: token }).lean();
  if (!request || request.status !== "issued") {
    return { ok: false, status: 404, message: "Invalid or expired reset link" };
  }

  if (!request.expiresAt || new Date(request.expiresAt).getTime() <= Date.now()) {
    await PasswordResetRequest.updateOne({ _id: request._id }, { $set: { status: "expired" } });
    return { ok: false, status: 410, message: "This reset link has expired" };
  }

  return {
    ok: true,
    status: 200,
    reset: {
      emailHint: request.email,
      expiresAt: request.expiresAt,
    },
  };
}

export async function completePasswordReset({ linkToken, email, code, password }) {
  const token = String(linkToken || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedCode = String(code || "").trim();
  const nextPassword = String(password || "");

  if (!token || !normalizedEmail || !normalizedCode || !nextPassword) {
    return { ok: false, status: 422, message: "Email, reset code, and new password are required" };
  }

  if (nextPassword.length < 6) {
    return { ok: false, status: 422, message: "Password must be at least 6 characters" };
  }

  if (!/^\d{6}$/.test(normalizedCode)) {
    return { ok: false, status: 422, message: "Reset code must be 6 digits" };
  }

  const request = await PasswordResetRequest.findOne({ linkToken: token });
  if (!request || request.status !== "issued") {
    return { ok: false, status: 400, message: "Invalid or expired reset link" };
  }

  if (!request.expiresAt || request.expiresAt.getTime() <= Date.now()) {
    request.status = "expired";
    await request.save();
    return { ok: false, status: 410, message: "This reset link has expired" };
  }

  if (request.email !== normalizedEmail) {
    return { ok: false, status: 400, message: "Email does not match this reset link" };
  }

  if (!request.codeHash || request.codeHash !== hashPasswordResetCode(normalizedCode)) {
    return { ok: false, status: 400, message: "Invalid reset code" };
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return { ok: false, status: 400, message: "Account not found" };
  }

  user.password = await hashPassword(nextPassword);
  user.passwordResetOtpHash = null;
  user.passwordResetOtpExpiresAt = null;
  await user.save();

  request.status = "used";
  request.usedAt = new Date();
  request.codeHash = null;
  await request.save();

  await UserSession.updateMany(
    { userId: user._id, status: "active" },
    {
      $set: {
        status: "revoked",
        revokedAt: new Date(),
        revokeReason: "password_reset",
      },
    }
  );

  return { ok: true, status: 200, message: "Password reset successful. You can sign in now." };
}

export function serializePasswordResetRequest(doc, { includeSecrets = false } = {}) {
  const item = {
    id: doc._id.toString(),
    email: doc.email,
    userId: doc.userId?.toString?.() || doc.userId || null,
    status: doc.status,
    expiresAt: doc.expiresAt || null,
    issuedAt: doc.issuedAt || null,
    usedAt: doc.usedAt || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    issuedBy: doc.issuedBy
      ? {
          id: doc.issuedBy._id?.toString?.() || doc.issuedBy.toString?.() || null,
          name: doc.issuedBy.name || null,
          email: doc.issuedBy.email || null,
        }
      : null,
    hasActiveLink: Boolean(doc.linkToken && doc.status === "issued"),
  };

  if (includeSecrets && doc.linkToken && doc.status === "issued") {
    item.resetUrl = buildPasswordResetUrl(doc.linkToken);
    item.linkToken = doc.linkToken;
  }

  return item;
}
