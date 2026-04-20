import { fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/adminSession";
import { connectDB } from "@/lib/db";
import CMSPage from "@/models/CMSPage";
import CMSSubmission from "@/models/CMSSubmission";
import { ensureCmsPage, isValidCMSPageKey } from "@/lib/cms";
import { CMS_PAGE_KEYS } from "@/lib/cmsDefaults";

export const runtime = "nodejs";

export async function GET(request) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  const { role } = admin;
  if (role !== "superadmin" && role !== "manager") {
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

    const pageMap = new Map(pages.map((item) => [item.key, item]));
    const currentPage = pageMap.get(pageKey) || null;

    return ok({
      role,
      pages: CMS_PAGE_KEYS.map((key) => {
        const page = pageMap.get(key);
        const pendingCount = pendingSubmissions.filter(
          (item) => item.pageKey === key && item.status === "pending"
        ).length;
        return {
          key,
          version: page?.version || 1,
          updatedAt: page?.updatedAt || page?.createdAt || null,
          pendingCount,
        };
      }),
      currentPage: currentPage
        ? {
            key: currentPage.key,
            content: currentPage.content,
            version: currentPage.version,
            updatedAt: currentPage.updatedAt || currentPage.createdAt,
          }
        : null,
      pendingSubmissions: pendingSubmissions.map((item) => ({
        id: item._id.toString(),
        pageKey: item.pageKey,
        status: item.status,
        submittedBy: item.submittedBy
          ? { name: item.submittedBy.name, email: item.submittedBy.email }
          : null,
        submittedRole: item.submittedRole,
        diff: item.diff || [],
        feedback: item.feedback || "",
        createdAt: item.createdAt,
      })),
    });
  } catch (err) {
    console.error("Admin CMS GET error:", err);
    return fail("Internal server error", 500);
  }
}
