import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { connectDB } from "@/lib/db";
import CMSPage from "@/models/CMSPage";
import CMSSubmission from "@/models/CMSSubmission";
import {
  canAccessContentEditor,
  ensureCmsPage,
  isValidCMSPageKey,
  normalizeCmsRole,
} from "@/lib/cms";
import { CMS_PAGE_KEYS } from "@/lib/cmsDefaults";

export const runtime = "nodejs";

export async function GET(request) {
  const { user, error } = await requireUser();
  if (error) return error;

  if (!canAccessContentEditor(user)) {
    return fail("Forbidden", 403);
  }

  try {
    const { searchParams } = new URL(request.url);
    const pageKey = String(searchParams.get("page") || "home");

    if (!isValidCMSPageKey(pageKey)) {
      return fail("Invalid page key", 400);
    }

    await connectDB();

    await Promise.all(CMS_PAGE_KEYS.map((key) => ensureCmsPage(key)));

    const [pages, pendingSubmissions] = await Promise.all([
      CMSPage.find({ key: { $in: CMS_PAGE_KEYS } }).sort({ key: 1 }).lean(),
      CMSSubmission.find({ status: "pending" })
        .sort({ createdAt: -1 })
        .populate("submittedBy", "name email")
        .lean(),
    ]);

    const role = normalizeCmsRole(user);
    const visiblePending = role === "team_member"
      ? pendingSubmissions.filter((item) => item.submittedBy?._id?.toString?.() === user._id.toString())
      : pendingSubmissions;

    const pageMap = new Map(pages.map((item) => [item.key, item]));

    return ok({
      role,
      canEdit: canAccessContentEditor(user),
      pages: CMS_PAGE_KEYS.map((key) => {
        const page = pageMap.get(key);
        const pendingCount = pendingSubmissions.filter((item) => item.pageKey === key && item.status === "pending").length;
        return {
          key,
          version: page?.version || 1,
          updatedAt: page?.updatedAt || page?.createdAt || null,
          pendingCount,
        };
      }),
      currentPage: pageMap.get(pageKey) || null,
      pendingSubmissions: visiblePending.map((item) => ({
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
        createdAt: item.createdAt,
      })),
    });
  } catch (caughtError) {
    console.error("CMS editor fetch error:", caughtError);
    return fail("Failed to load content editor", 500);
  }
}
