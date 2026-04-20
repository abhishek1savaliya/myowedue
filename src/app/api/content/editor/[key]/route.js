import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { connectDB } from "@/lib/db";
import CMSPage from "@/models/CMSPage";
import CMSSubmission from "@/models/CMSSubmission";
import {
  canAccessContentEditor,
  canPublishContent,
  computeContentDiff,
  createCmsAuditLog,
  ensureCmsPage,
  isValidCMSPageKey,
  normalizeCmsRole,
} from "@/lib/cms";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  if (!canAccessContentEditor(user)) {
    return fail("Forbidden", 403);
  }

  try {
    const { key } = await params;
    if (!isValidCMSPageKey(key)) {
      return fail("Invalid page key", 400);
    }

    await connectDB();
    const page = await ensureCmsPage(key);

    const role = normalizeCmsRole(user);
    const pendingQuery = { pageKey: key, status: "pending" };
    if (role === "team_member") {
      pendingQuery.submittedBy = user._id;
    }

    const pendingSubmissions = await CMSSubmission.find(pendingQuery)
      .sort({ createdAt: -1 })
      .populate("submittedBy", "name email")
      .lean();

    return ok({
      page: {
        key: page.key,
        content: page.content || {},
        version: page.version || 1,
        publishedAt: page.publishedAt,
        updatedAt: page.updatedAt,
      },
      pendingSubmissions: pendingSubmissions.map((item) => ({
        id: item._id.toString(),
        pageKey: item.pageKey,
        status: item.status,
        submittedRole: item.submittedRole,
        submittedBy: {
          id: item.submittedBy?._id?.toString?.() || "",
          name: item.submittedBy?.name || "Unknown",
          email: item.submittedBy?.email || "",
        },
        feedback: item.feedback || "",
        diff: item.diff || [],
        proposedContent: item.proposedContent || {},
        createdAt: item.createdAt,
      })),
    });
  } catch (caughtError) {
    console.error("CMS page editor fetch error:", caughtError);
    return fail("Failed to load page editor", 500);
  }
}

export async function POST(request, { params }) {
  const { user, error } = await requireUser();
  if (error) return error;

  if (!canAccessContentEditor(user)) {
    return fail("Forbidden", 403);
  }

  try {
    const { key } = await params;
    if (!isValidCMSPageKey(key)) {
      return fail("Invalid page key", 400);
    }

    const body = await request.json();
    const nextContent = body?.content;
    const detail = String(body?.detail || "").trim();

    if (!nextContent || typeof nextContent !== "object") {
      return fail("Content object is required", 422);
    }

    await connectDB();
    const page = await ensureCmsPage(key);
    const previousContent = page.content || {};
    const diff = computeContentDiff(previousContent, nextContent);
    const actorRole = normalizeCmsRole(user);

    if (canPublishContent(user)) {
      page.content = nextContent;
      page.version = Number(page.version || 1) + 1;
      page.publishedBy = user._id;
      page.publishedAt = new Date();
      page.markModified("content");
      await page.save();

      await createCmsAuditLog({
        action: "content_published",
        pageKey: key,
        actorUserId: user._id,
        actorRole,
        detail: detail || "Published content directly",
        diff,
        previousContent,
        updatedContent: nextContent,
      });

      return ok({
        mode: "published",
        page: {
          key: page.key,
          content: page.content,
          version: page.version,
          updatedAt: page.updatedAt,
          publishedAt: page.publishedAt,
        },
      });
    }

    const submission = await CMSSubmission.create({
      pageKey: key,
      proposedContent: nextContent,
      status: "pending",
      submittedBy: user._id,
      submittedRole: actorRole,
      baseVersion: page.version || 1,
      diff,
      feedback: detail,
    });

    await createCmsAuditLog({
      action: "submission_created",
      pageKey: key,
      actorUserId: user._id,
      actorRole,
      submissionId: submission._id,
      detail: detail || "Submitted content for manager review",
      diff,
      previousContent,
      updatedContent: nextContent,
    });

    return ok({
      mode: "pending",
      submission: {
        id: submission._id.toString(),
        status: submission.status,
        pageKey: submission.pageKey,
        createdAt: submission.createdAt,
      },
    });
  } catch (caughtError) {
    console.error("CMS submit error:", caughtError);
    return fail("Failed to submit content changes", 500);
  }
}
