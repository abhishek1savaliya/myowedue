import {
  Cormorant_Garamond,
  Inter,
  Manrope,
  Montserrat,
  Playfair_Display,
  Plus_Jakarta_Sans,
  Poppins,
  Roboto,
} from "next/font/google";
import "./globals.css";
import "@vidstack/react/player/styles/base.css";
import ThemeSync from "@/components/ThemeSync";
import AppStoreBootstrap from "@/components/AppStoreBootstrap";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import { AppAlertProvider } from "@/components/AppAlertProvider";
import SeoJsonLd from "@/components/SeoJsonLd";
import { buildSiteGraphJsonLd, DEFAULT_DESCRIPTION, SITE_NAME, SITE_TAGLINE, defaultOgImages } from "@/lib/site-seo";
import { getUiPreferenceBootstrapScript } from "@/lib/cookie-preferences";
import { getThemeBootstrapScript } from "@/lib/theme-client";
import { DEFAULT_FONT_PRESET, DEFAULT_FONT_SIZE_PRESET, getFontPreset, getFontSizePreset } from "@/lib/appearance";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

/** Marketing / landing — crisp SaaS typography (Stripe-adjacent). */
const landing = Plus_Jakarta_Sans({
  variable: "--font-landing",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const googleInter = Inter({
  variable: "--font-google-inter",
  subsets: ["latin"],
});

const googleRoboto = Roboto({
  variable: "--font-google-roboto",
  subsets: ["latin"],
});

const googlePoppins = Poppins({
  variable: "--font-google-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const googleMontserrat = Montserrat({
  variable: "--font-google-montserrat",
  subsets: ["latin"],
});

const googlePlayfair = Playfair_Display({
  variable: "--font-google-playfair",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://myowedue.vercel.app";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1020" },
  ],
};

export const metadata = {
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [{ url: "/owedue-logo.svg", type: "image/svg+xml" }],
    shortcut: "/owedue-logo.svg",
    apple: "/owedue-logo.svg",
  },
  title: {
    default: `${SITE_NAME} | ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "due tracker",
    "credit tracker",
    "debit tracker",
    "expense reminder",
    "personal finance organizer",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "OWE DUE",
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: DEFAULT_DESCRIPTION,
    images: defaultOgImages(),
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: DEFAULT_DESCRIPTION,
    images: ["/owedue-logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "finance",
};

export default function RootLayout({ children }) {
  const siteGraphJsonLd = buildSiteGraphJsonLd();
  const uiPreferenceBootstrapScript = getUiPreferenceBootstrapScript();
  const themeBootstrapScript = getThemeBootstrapScript();
  const defaultFont = getFontPreset(DEFAULT_FONT_PRESET);
  const defaultSize = getFontSizePreset(DEFAULT_FONT_SIZE_PRESET);
  const defaultMobileScale =
    defaultSize.scale <= 1 ? defaultSize.scale : 1 + (defaultSize.scale - 1) * 0.55;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${landing.variable} ${googleInter.variable} ${googleRoboto.variable} ${googlePoppins.variable} ${googleMontserrat.variable} ${googlePlayfair.variable} h-full antialiased`}
      data-theme="light"
      data-ui-v2="true"
      data-premium-ui="true"
      data-font-preset={DEFAULT_FONT_PRESET}
      data-font-size-preset={DEFAULT_FONT_SIZE_PRESET}
      style={{
        "--ui-body-font": defaultFont.body,
        "--ui-display-font": defaultFont.display,
        "--ui-font-scale": String(defaultSize.scale),
        "--ui-font-size-mobile": `${15 * defaultMobileScale}px`,
        "--ui-font-size-desktop": `${16 * defaultSize.scale}px`,
        "--ui-type-scale-mobile": String(defaultMobileScale),
        "--ui-type-scale-desktop": String(defaultSize.scale),
      }}
    >
      <body suppressHydrationWarning className="flex min-h-full w-full max-w-full flex-col overflow-x-clip">
        <script
          id="myowedue-theme-boot"
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
        <script
          id="myowedue-ui-pref-boot"
          dangerouslySetInnerHTML={{ __html: uiPreferenceBootstrapScript }}
        />
        <SeoJsonLd data={siteGraphJsonLd} />
        <AppStoreBootstrap />
        <ThemeSync />
        <AppAlertProvider>
          {children}
          <CookieConsentBanner />
        </AppAlertProvider>
      </body>
    </html>
  );
}
