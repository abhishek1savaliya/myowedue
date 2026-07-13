import { backfillCommunityPostSeoBatch } from "@/lib/community-post-seo";
import { getCommunitySiteUrl } from "@/lib/community-seo";
import { fetchCommunityPostSitemapRows } from "@/lib/community-seo-server";
import { PUBLIC_SITELINKS } from "@/lib/site-seo";

export default async function sitemap() {
  const siteUrl = getCommunitySiteUrl();
  const now = new Date();

  await backfillCommunityPostSeoBatch(40).catch(() => {});

  const staticFromNav = PUBLIC_SITELINKS.map((link) => ({
    url: `${siteUrl}${link.path}`,
    lastModified: now,
    changeFrequency: link.path === "/community" ? "daily" : "monthly",
    priority: link.path === "/" ? 1 : link.path === "/signup" ? 0.85 : 0.7,
  }));

  const staticEntries = [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/community/posts.xml`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.75,
    },
    ...staticFromNav.filter((e) => e.url !== `${siteUrl}/`),
  ];

  const rows = await fetchCommunityPostSitemapRows();
  const postEntries = rows.map((row) => ({
    url: `${siteUrl}/community/post/${row.id}`,
    lastModified: row.updated_at ? new Date(row.updated_at) : now,
    changeFrequency: "weekly",
    priority: 0.65,
  }));

  const seen = new Set();
  const merged = [...staticEntries, ...postEntries].filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });

  return merged;
}
