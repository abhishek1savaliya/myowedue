export const CMS_PAGE_KEYS = ["home", "contact-us", "privacy-policy"];

export const CMS_DEFAULT_CONTENT = {
  home: {
    heroBadge: "Built for independent earners",
    heroTitle: "Track every rupee, rupee, without the chaos.",
    heroDescription:
      "Manage who owes you and what you owe. Send reminders, export reports, and keep complete history in one premium workspace.",
    ctaPrimary: "Create your account",
    ctaSecondary: "Already have an account",
    heroStats: [
      { value: "3 min", label: "Setup time" },
      { value: "∞", label: "People & transactions" },
      { value: "100%", label: "Historical tracking" },
    ],
    highlightTitle: "Try now",
    highlightItems: [
      "People Ledger",
      "Timeline",
      "Reports",
      "Reminders",
      "Deletion Bin",
      "Smart Filters",
    ],
    featuresEyebrow: "Explore features",
    featuresTitle: "Everything you need in one workspace",
    features: [
      {
        eyebrow: "People Ledger",
        title: "Clean relationship view",
        description: "See who owes you and what you owe in one glance, with due totals and latest activity.",
      },
      {
        eyebrow: "Timeline",
        title: "Never lose context",
        description: "Every update, payment, delete, and restore with clear date-time history you can trust.",
      },
      {
        eyebrow: "Reports",
        title: "Export & share",
        description: "PDF and CSV exports for reviews, bookkeeping snapshots, and professional sharing.",
      },
      {
        eyebrow: "Reminders",
        title: "Smart reminders",
        description: "Send polite reminder emails with one click, keeping payment communication professional.",
      },
      {
        eyebrow: "Deletion Bin",
        title: "Safe recovery",
        description: "Recover deleted records anytime with full historical context and timeline preserved.",
      },
      {
        eyebrow: "Smart Filters",
        title: "Find instantly",
        description: "Filter by date, status, type, and person to find any entry in seconds.",
      },
    ],
    howItWorksEyebrow: "How it works",
    howItWorksTitle: "From signup to control",
    howItWorksSteps: [
      "Create account and add people",
      "Log debit/credit transactions",
      "Mark paid, send reminders, recover",
      "Export reports & track history",
    ],
    whyChooseEyebrow: "Why choose us",
    whyChooseTitle: "Built to feel effortless",
    whyChooseItems: [
      "Purpose-built for personal dues",
      "Premium interface, fast & mobile-friendly",
      "Transparent, traceable history",
      "Perfect for freelancers & households",
    ],
    securityEyebrow: "Trust & Security",
    securityTitle: "Your data, protected",
    securityItems: [
      {
        title: "Session protection",
        description: "Authenticated routes and secure cookies keep your data in your account.",
      },
      {
        title: "Safe deletion",
        description: "Recovery workflows preserve your history and let you undo mistakes.",
      },
      {
        title: "Audit logs",
        description: "Complete transparency on what changed and when, with full traceability.",
      },
    ],
    plansEyebrow: "Plans",
    plansTitle: "Choose the plan that fits your workflow",
    plansDescription:
      "Start free for everyday tracking, then move to Pro when you need unlimited records, premium exports, advanced reminders, and payment workflows.",
    freePlan: {
      badge: "Free Plan",
      name: "Free",
      price: "$0",
      billing: "/forever",
      description: "Best for getting started with personal due tracking and everyday reminders.",
      features: [
        "50 active people and 50 active transactions",
        "Basic dashboard and reporting",
        "CSV and JPG exports",
        "Standard reminder workflow",
      ],
      ctaLabel: "Get started free",
      ctaHref: "/signup",
    },
    paidPlan: {
      badge: "Pro Plan",
      name: "Pro",
      price: "$7",
      billing: "/month or $70/year",
      description: "Built for users who need unlimited growth, premium exports, recurring dues, and better payment collection tools.",
      features: [
        "Unlimited people and transactions",
        "Recurring dues and payment links",
        "Premium PDF and Excel exports",
        "Advanced reports, support, and appearance controls",
      ],
      ctaLabel: "View Pro options",
      ctaHref: "/signup",
    },
    plansFootnote:
      "Plan text on this front page can be updated anytime from the admin content editor by super admin and manager.",
    finalCtaTitle: "Join thousands of users tracking dues effortlessly.",
  },
  "contact-us": {
    heading: "Need help with your account?",
    description:
      "Tell us what you need, and our team will get back with setup, troubleshooting, or product guidance.",
    contactItems: [
      "Product help: support@myowedue.com",
      "Billing queries: billing@myowedue.com",
      "Partnerships: partners@myowedue.com",
    ],
    formTitle: "Quick message",
    successTitle: "Message sent!",
    successDescription: "Our support team will get back to you soon.",
  },
  "privacy-policy": {
    heading: "Privacy Policy",
    effectiveDate: "April 13, 2026",
    sections: [
      {
        title: "1. Information We Collect",
        body:
          "We collect account and transaction details you enter, including names, contact fields, transaction amounts, notes, and timeline events necessary for the service to function.",
      },
      {
        title: "2. How We Use Data",
        body:
          "Data is used to provide core features such as transaction tracking, reminders, reports, restore functionality, and account security.",
      },
      {
        title: "3. Data Retention",
        body:
          "Deleted items may remain in the bin for a limited recovery window. After that period, records can be permanently removed by system cleanup.",
      },
      {
        title: "4. Security",
        body:
          "We use authentication controls and route protection to restrict access to your account data. You are responsible for maintaining the confidentiality of your login credentials.",
      },
      {
        title: "5. Contact",
        body: "For privacy-related questions, visit the contact page or email the support address configured by your deployment.",
      },
    ],
  },
};

export function getDefaultContentForKey(pageKey) {
  const fallback = CMS_DEFAULT_CONTENT[pageKey];
  return fallback ? JSON.parse(JSON.stringify(fallback)) : {};
}
