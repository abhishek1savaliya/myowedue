import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { fail, logActivity, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import Transaction from "@/models/Transaction";
import { activeQuery } from "@/lib/bin";
import { supportsPremiumSupport } from "@/lib/subscription";

export async function POST(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  if (!supportsPremiumSupport(user)) {
    return fail("Premium subscription required for payment links", 403);
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const visibility = body?.visibility === "private" ? "private" : "public";

    await connectDB();
    const tx = await Transaction.findOne({ _id: id, userId: user._id, ...activeQuery() });
    if (!tx) return fail("Transaction not found", 404);

    const isFirstGeneration = !tx.paymentLinkToken;

    if (isFirstGeneration) {
      tx.paymentLinkToken = crypto.randomBytes(18).toString("hex");
      tx.paymentLinkCreatedAt = new Date();
      tx.changeLogs.push({
        action: "payment_link_generated",
        message: `Payment link generated at ${new Date().toLocaleString()}`,
        at: new Date(),
      });
    }

    const previousVisibility = tx.paymentLinkVisibility || "public";
    tx.paymentLinkVisibility = visibility;
    if (previousVisibility !== visibility) {
      tx.changeLogs.push({
        action: "payment_link_visibility_updated",
        message: `Payment link changed to ${visibility.toUpperCase()} at ${new Date().toLocaleString()}`,
        at: new Date(),
      });
    }
    await tx.save();

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const paymentLinkUrl = `${siteUrl}/pay/${tx.paymentLinkToken}`;

    await logActivity(
      user._id,
      isFirstGeneration ? "payment_link_generated" : "payment_link_updated",
      `${isFirstGeneration ? "Generated" : "Updated"} payment link for transaction ${tx._id}`
    );

    return ok({ paymentLinkUrl, paymentLinkToken: tx.paymentLinkToken, paymentLinkCreatedAt: tx.paymentLinkCreatedAt, paymentLinkVisibility: visibility });
  } catch (caughtError) {
    console.error("Payment link generation error:", caughtError);
    return fail("Failed to generate payment link", 500);
  }
}
