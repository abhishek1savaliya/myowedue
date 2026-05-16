import {
  excerptFromPostBody,
  fetchCommunityFeedForSeo,
  getCommunitySiteUrl,
  titleSnippetFromPost,
} from "@/lib/community-seo";

export const revalidate = 300;

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const site = getCommunitySiteUrl();
  const { posts } = await fetchCommunityFeedForSeo(100);

  const items = posts
    .map((post) => {
      const link = `${site}/community/post/${post.id}`;
      const title =
        post.seo_title?.replace(/\s*\|\s*OWE DUE Community$/i, "").trim() ||
        titleSnippetFromPost(post, 80);
      const description =
        post.seo_description || excerptFromPostBody(post.body, 300);
      const pubDate = post.created_at ? new Date(post.created_at).toUTCString() : new Date().toUTCString();

      return `<item>
  <title>${escapeXml(title)}</title>
  <link>${escapeXml(link)}</link>
  <guid isPermaLink="true">${escapeXml(link)}</guid>
  <pubDate>${escapeXml(pubDate)}</pubDate>
  <description>${escapeXml(description)}</description>
  <author>${escapeXml(post.author_name)}</author>
</item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>OWE DUE Community — latest posts</title>
    <link>${escapeXml(`${site}/community`)}</link>
    <description>Public community posts from OWE DUE members and visitors.</description>
    <language>en-au</language>
    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>
    <atom:link href="${escapeXml(`${site}/community/posts.xml`)}" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
