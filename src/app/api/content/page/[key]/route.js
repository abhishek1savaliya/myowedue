import { fail, ok } from "@/lib/api";
import { getPublishedContent, isValidCMSPageKey } from "@/lib/cms";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  try {
    const { key } = await params;
    if (!isValidCMSPageKey(key)) {
      return fail("Invalid page key", 400);
    }
    const payload = await getPublishedContent(key);
    return ok(payload);
  } catch (error) {
    console.error("CMS page fetch error:", error);
    return fail("Failed to fetch page content", 500);
  }
}
