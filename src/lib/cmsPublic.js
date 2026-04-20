import { getPublishedContent } from "@/lib/cms";
import { getDefaultContentForKey } from "@/lib/cmsDefaults";

export async function getCmsPageContent(pageKey) {
  const payload = await getPublishedContent(pageKey);
  const fallback = getDefaultContentForKey(pageKey);
  return {
    key: payload.key,
    version: payload.version,
    publishedAt: payload.publishedAt,
    content: {
      ...fallback,
      ...(payload.content || {}),
    },
  };
}
