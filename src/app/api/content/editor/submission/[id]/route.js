import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { connectDB } from "@/lib/db";
import CMSSubmission from "@/models/CMSSubmission";
import CMSPage from "@/models/CMSPage";
import {
  canReviewSubmissions,
  computeContentDiff,
  createCmsAuditLog,
  ensureCmsPage,
  normalizeCmsRole,
} from "@/lib/cms";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  if (!canReviewSubmissions(user)) {
    return fail("Forbidden", 403);
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const decision = String(body?.decision || "").toLowerCase();
    const feedback = String(body?.feedback || "").trim();

    if (!["approve", "reject"].includes(decision)) {
      return fail("Invalid decision", 422);
    }

    await connectDB();

    const submission = await CMSSubmission.findById(id);
    if (!submission) return fail("Submission not found", 404);
    if (submission.status !== "pending") return fail("Submission is already finalized", 409);

    const actorRole = normalizeCmsRole(user);

    if (decision === "reject") {
      submission.status = "rejected";
      submission.reviewedBy = user._id;
      submission.reviewedAt = new Date();
      submission.feedback = feedback;
      await submission.save();

      await createCmsAuditLog({
        action: "submission_rejected",
        pageKey: submission.pageKey,
        actorUserId: user._id,
        actorRole,
        submissionId: submission._id,
        targetUserId: submission.submittedBy,
        detail: feedback || "Submission rejected",
        diff: submission.diff || [],
        updatedContent: submission.proposedContent,
      });

      return ok({
        submission: {
          id: submission._id.toString(),
          status: submission.status,
          feedback: submission.feedback,
          reviewedAt: submission.reviewedAt,
        },
      });
    }

    const page = await ensureCmsPage(submission.pageKey);
    const previousContent = page.content || {};
    page.content = submission.proposedContent || {};
    page.version = Number(page.version || 1) + 1;
    page.publishedBy = user._id;
    page.publishedAt = new Date();
    page.markModified("content");
    await page.save();

    submission.status = "approved";
    submission.reviewedBy = user._id;
    submission.reviewedAt = new Date();
    submission.feedback = feedback;
    await submission.save();

    const diff = submission.diff?.length
      ? submission.diff
      : computeContentDiff(previousContent, page.content);

    await createCmsAuditLog({
      action: "submission_approved",
      pageKey: submission.pageKey,
      actorUserId: user._id,
      actorRole,
      submissionId: submission._id,
      targetUserId: submission.submittedBy,
      detail: feedback || "Submission approved and published",
      diff,
      previousContent,
      updatedContent: page.content,
    });

    return ok({
      submission: {
        id: submission._id.toString(),
        status: submission.status,
        feedback: submission.feedback,
        reviewedAt: submission.reviewedAt,
      },
      page: {
        key: page.key,
        version: page.version,
        publishedAt: page.publishedAt,
      },
    });
  } catch (caughtError) {
    console.error("CMS submission review error:", caughtError);
    return fail("Failed to review submission", 500);
  }
}
