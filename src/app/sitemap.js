import { fetchCommunityPostSitemapRows, getCommunitySiteUrl } from "@/lib/community-seo";

export default async function sitemap() {
  const siteUrl = getCommunitySiteUrl();
  const now = new Date();

  const staticEntries = [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/community`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/signup`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/privacy-policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/contact-us`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];

  const rows = await fetchCommunityPostSitemapRows();
  const postEntries = rows.map((row) => ({
    url: `${siteUrl}/community/post/${row.id}`,
    lastModified: row.updated_at ? new Date(row.updated_at) : now,
    changeFrequency: "weekly",
    priority: 0.65,
  }));

  return [...staticEntries, ...postEntries];
}
