import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";

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
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
