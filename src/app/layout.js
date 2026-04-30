import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";
import ThemeSync from "@/components/ThemeSync";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import { getUiPreferenceBootstrapScript } from "@/lib/cookie-preferences";
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://myowedue.vercel.app";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "OWE DUE | Personal Credit & Debit Tracker",
    template: "%s | OWE DUE",
  },
  description:
    "Track credits, debits, reminders, and due history in one premium workspace. Import events, get smart notifications, and stay on top of every due.",
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
    title: "OWE DUE | Personal Credit & Debit Tracker",
    description:
      "Manage who owes you and what you owe with reminders, events, and detailed history.",
    images: [
      {
        url: "/owedue-logo.svg",
        width: 160,
        height: 160,
        alt: "OWE DUE logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "OWE DUE | Personal Credit & Debit Tracker",
    description:
      "Manage who owes you and what you owe with reminders, events, and detailed history.",
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
  const uiPreferenceBootstrapScript = getUiPreferenceBootstrapScript();
  const defaultFont = getFontPreset(DEFAULT_FONT_PRESET);
  const defaultSize = getFontSizePreset(DEFAULT_FONT_SIZE_PRESET);
  const defaultMobileScale =
    defaultSize.scale <= 1 ? defaultSize.scale : 1 + (defaultSize.scale - 1) * 0.55;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} h-full antialiased`}
      data-premium-ui="false"
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
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <script
          id="myowedue-ui-pref-boot"
          dangerouslySetInnerHTML={{ __html: uiPreferenceBootstrapScript }}
        />
        <ThemeSync />
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
