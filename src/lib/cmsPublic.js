import { getPublishedContent } from "@/lib/cms";
import { getDefaultContentForKey } from "@/lib/cmsDefaults";

export async function getCmsPageContent(pageKey) {
  const fallback = getDefaultContentForKey(pageKey);
  try {
    const payload = await getPublishedContent(pageKey);
    return {
      key: payload.key,
      version: payload.version,
      publishedAt: payload.publishedAt,
      content: {
        ...fallback,
        ...(payload.content || {}),
      },
    };
  } catch (err) {
    console.warn(`[cms] ${pageKey}: using defaults (${err?.message || "db unavailable"})`);
    return {
      key: pageKey,
      version: 0,
      publishedAt: null,
      content: fallback,
    };
  }
}
