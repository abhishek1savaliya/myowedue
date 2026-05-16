/**
 * Renders Schema.org JSON-LD. Pass data from buildSiteGraphJsonLd() or page-specific builders.
 * @param {{ data: object }} props
 */
export default function SeoJsonLd({ data }) {
  if (!data || typeof data !== "object") return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
