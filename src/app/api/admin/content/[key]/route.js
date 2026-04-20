import { fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/adminSession";
import { connectDB } from "@/lib/db";
import CMSPage from "@/models/CMSPage";
import CMSSubmission from "@/models/CMSSubmission";
import {
  ensureCmsPage,
  isValidCMSPageKey,
  computeContentDiff,
  createCmsAuditLog,
} from "@/lib/cms";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  const { role } = admin;
  if (role !== "superadmin" && role !== "manager") {
    return fail("Forbidden", 403);
  }

  const { key } = await params;
  if (!isValidCMSPageKey(key)) {
    return fail("Invalid page key", 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const { content, detail } = body;
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return fail("Content must be a JSON object", 422);
  }

  try {
    await connectDB();

    const page = await ensureCmsPage(key);
    const previousContent = page.content;
    const diff = computeContentDiff(previousContent, content);

    page.content = content;
    page.version = (page.version || 1) + 1;
    page.publishedAt = new Date();
    page.publishedBy = null;
    page.markModified("content");
    await page.save();

    await createCmsAuditLog({
      action: "content_published",
      pageKey: key,
      actorUserId: admin._id.toString(),
      actorRole: role,
      detail: detail || `Published by admin ${admin.name || admin.email}`,
      diff,
      previousContent,
      updatedContent: content,
    });

    return ok({ mode: "published", version: page.version });
  } catch (err) {
    console.error("Admin CMS POST error:", err);
    return fail("Internal server error", 500);
  }
}

export async function PATCH(request, { params }) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  const { role } = admin;
  if (role !== "superadmin" && role !== "manager") {
    return fail("Forbidden", 403);
  }

  const { key } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const { submissionId, decision, feedback } = body;

  if (!submissionId || !["approve", "reject"].includes(decision)) {
    return fail("submissionId and decision (approve|reject) are required", 422);
  }

  if (decision === "reject" && !String(feedback || "").trim()) {
    return fail("Feedback is required when rejecting", 422);
  }

  try {
    await connectDB();

    const submission = await CMSSubmission.findById(submissionId);
    if (!submission) return fail("Submission not found", 404);
    if (submission.status !== "pending") return fail("Submission is no longer pending", 409);

    submission.status = decision === "approve" ? "approved" : "rejected";
    submission.reviewedBy = admin._id.toString();
    submission.reviewedAt = new Date();
    submission.feedback = feedback || "";
    await submission.save();

    if (decision === "approve") {
      const page = await ensureCmsPage(submission.pageKey);
      const previousContent = page.content;

      page.content = submission.proposedContent;
      page.version = (page.version || 1) + 1;
      page.publishedAt = new Date();
      page.markModified("content");
      await page.save();

      await createCmsAuditLog({
        action: "submission_approved",
        pageKey: submission.pageKey,
        actorUserId: admin._id.toString(),
        actorRole: role,
        submissionId: submission._id,
        diff: submission.diff || [],
        previousContent,
        updatedContent: submission.proposedContent,
      });
    } else {
      await createCmsAuditLog({
        action: "submission_rejected",
        pageKey: submission.pageKey,
        actorUserId: admin._id.toString(),
        actorRole: role,
        submissionId: submission._id,
        detail: feedback,
      });
    }

    return ok({ success: true, decision });
  } catch (err) {
    console.error("Admin CMS PATCH error:", err);
    return fail("Internal server error", 500);
  }
}
