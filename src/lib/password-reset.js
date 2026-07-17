import "server-only";
import { createHash, randomInt } from "crypto";
import { hashPassword } from "@/lib/auth";
import User from "@/models/User";
import UserSession from "@/models/UserSession";
import { sendMail } from "@/lib/mailer";

export const DEV_PASSWORD_RESET_OTP = "112233";
const OTP_TTL_MS = 15 * 60 * 1000;

function hashOtp(otp) {
  return createHash("sha256").update(String(otp)).digest("hex");
}

function generateOtp() {
  return String(randomInt(100000, 1000000));
}

export function isDevPasswordResetOtp(otp) {
  return process.env.NODE_ENV === "development" && String(otp).trim() === DEV_PASSWORD_RESET_OTP;
}

export async function issuePasswordResetOtp(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, status: 422, message: "Email is required" };
  }

  const user = await User.findOne({ email: normalizedEmail }).select("_id email name");
  if (!user) {
    return {
      ok: true,
      status: 200,
      message: "If that email is registered, a reset code has been sent.",
      devOtp: null,
    };
  }

  const otp = generateOtp();
  user.passwordResetOtpHash = hashOtp(otp);
  user.passwordResetOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  await user.save();

  const mailResult = await sendMail({
    to: user.email,
    subject: "Reset your MYOWEDUE password",
    headline: "Password reset code",
    message: `Use this code to reset your password: <strong style="font-size:18px;letter-spacing:0.2em;">${otp}</strong>. It expires in 15 minutes. If you did not request this, you can ignore this email.`,
  });

  const response = {
    ok: true,
    status: 200,
    message: "If that email is registered, a reset code has been sent.",
    devOtp: null,
  };

  if (process.env.NODE_ENV === "development") {
    if (!mailResult?.ok) {
      response.devOtp = otp;
      response.message = `Development mode: use OTP ${otp} or test code ${DEV_PASSWORD_RESET_OTP}.`;
    } else {
      response.message = `Reset code sent. In development you can also use test code ${DEV_PASSWORD_RESET_OTP}.`;
    }
  }

  return response;
}

export async function resetPasswordWithOtp({ email, otp, password }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedOtp = String(otp || "").trim();
  const nextPassword = String(password || "");

  if (!normalizedEmail || !normalizedOtp || !nextPassword) {
    return { ok: false, status: 422, message: "Email, reset code, and new password are required" };
  }

  if (nextPassword.length < 6) {
    return { ok: false, status: 422, message: "Password must be at least 6 characters" };
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return { ok: false, status: 400, message: "Invalid or expired reset code" };
  }

  const devBypass = isDevPasswordResetOtp(normalizedOtp);
  const otpValid =
    devBypass ||
    (user.passwordResetOtpHash &&
      user.passwordResetOtpExpiresAt &&
      user.passwordResetOtpExpiresAt.getTime() > Date.now() &&
      user.passwordResetOtpHash === hashOtp(normalizedOtp));

  if (!otpValid) {
    return { ok: false, status: 400, message: "Invalid or expired reset code" };
  }

  user.password = await hashPassword(nextPassword);
  user.passwordResetOtpHash = null;
  user.passwordResetOtpExpiresAt = null;
  await user.save();

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
