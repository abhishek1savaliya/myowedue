import {
  Bell,
  Calendar,
  FileText,
  Fingerprint,
  Lock,
  MessageCircle,
  Receipt,
  Shield,
  TrendingUp,
} from "lucide-react";

export const DEFAULT_FEATURES = [
  {
    eyebrow: "Ledger",
    title: "Credits & debits in one timeline",
    description: "Every handshake, invoice, and IOU—organized with running balances and smart filters.",
    icon: Receipt,
    span: "md:col-span-2 md:row-span-2",
  },
  {
    eyebrow: "Reminders",
    title: "Never miss a due date",
    description: "Email and in-app nudges tuned to your rhythm.",
    icon: Bell,
    span: "",
  },
  {
    eyebrow: "People",
    title: "Contacts that stay in sync",
    description: "Link dues to real people with full history.",
    icon: MessageCircle,
    span: "",
  },
  {
    eyebrow: "Files",
    title: "Receipts & agreements",
    description: "Attach proof to any transaction.",
    icon: FileText,
    span: "md:col-span-2",
  },
  {
    eyebrow: "Events",
    title: "Calendar-aware cash flow",
    description: "See what's coming before it hits.",
    icon: Calendar,
    span: "",
  },
  {
    eyebrow: "Reports",
    title: "Export-ready insights",
    description: "PDF summaries built for accountants and clients.",
    icon: TrendingUp,
    span: "",
  },
];

export const DEFAULT_SECURITY = [
  {
    title: "Encryption by default",
    description: "Sensitive fields protected in transit and at rest with industry-standard cryptography.",
    icon: Lock,
  },
  {
    title: "Session integrity",
    description: "Secure cookies, rotation, and device-aware login activity controls.",
    icon: Fingerprint,
  },
  {
    title: "Your data, your rules",
    description: "Export, audit, and delete on your terms—no dark patterns.",
    icon: Shield,
  },
];
