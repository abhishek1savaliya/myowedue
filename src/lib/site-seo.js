/**
 * Site-wide SEO: metadata helpers + Schema.org graph for rich results / sitelinks.
 * Note: Google chooses sitelinks automatically; clear nav + structured data helps.
 */

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://myowedue.vercel.app").replace(/\/$/, "");
}

export const SITE_NAME = "OWE DUE";
export const SITE_TAGLINE = "Personal Credit & Debit Tracker";

export const DEFAULT_DESCRIPTION =
  "OWE DUE is a personal finance workspace to track who owes you and what you owe — credits, debits, reminders, events, files, and community discussions in one place.";

/** Public pages Google may use as sitelinks (keep URLs stable). */
export const PUBLIC_SITELINKS = [
  {
    name: "Sign up free",
    path: "/signup",
    description: "Create your OWE DUE account and start tracking dues, people, and transactions.",
  },
  {
    name: "Log in",
    path: "/login",
    description: "Sign in to your dashboard, reminders, reports, and subscription.",
  },
  {
    name: "Community",
    path: "/community",
    description: "Public posts, trending topics, and conversations from OWE DUE members.",
  },
  {
    name: "Trending topics",
    path: "/community/trending",
    description: "See what the community is discussing in the last 24 hours.",
  },
  {
    name: "Contact support",
    path: "/contact-us",
    description: "Product help, billing questions, and partnership enquiries.",
  },
  {
    name: "Privacy policy",
    path: "/privacy-policy",
    description: "How OWE DUE collects, uses, and protects your data.",
  },
];

/**
 * @param {{ includeWebPage?: boolean; pageName?: string; pageDescription?: string; pagePath?: string }} [opts]
 */
export function buildSiteGraphJsonLd(opts = {}) {
  const site = getSiteUrl();
  const { includeWebPage = false, pageName, pageDescription, pagePath = "/" } = opts;

  const graph = [
    {
      "@type": "Organization",
      "@id": `${site}/#organization`,
      name: SITE_NAME,
      url: site,
      logo: {
        "@type": "ImageObject",
        url: `${site}/owedue-logo.svg`,
      },
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": `${site}/#website`,
      url: site,
      name: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      publisher: { "@id": `${site}/#organization` },
      inLanguage: "en-AU",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${site}/community/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${site}/#app`,
      name: SITE_NAME,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      description: DEFAULT_DESCRIPTION,
      url: site,
    },
    {
      "@type": "ItemList",
      "@id": `${site}/#site-navigation`,
      name: `${SITE_NAME} — main sections`,
      itemListElement: PUBLIC_SITELINKS.map((link, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "WebPage",
          "@id": `${site}${link.path}`,
          name: link.name,
          description: link.description,
          url: `${site}${link.path}`,
        },
      })),
    },
  ];

  if (includeWebPage) {
    const path = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
    graph.push({
      "@type": "WebPage",
      "@id": `${site}${path}#webpage`,
      url: `${site}${path}`,
      name: pageName || `${SITE_NAME} | ${SITE_TAGLINE}`,
      description: pageDescription || DEFAULT_DESCRIPTION,
      isPartOf: { "@id": `${site}/#website` },
      about: { "@id": `${site}/#organization` },
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

/** Default Open Graph image config (logo until a dedicated OG image exists). */
export function defaultOgImages() {
  return [
    {
      url: "/owedue-logo.svg",
      width: 512,
      height: 512,
      alt: `${SITE_NAME} logo`,
    },
  ];
}
