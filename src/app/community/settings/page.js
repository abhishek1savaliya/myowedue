import CommunitySettingsClient from "@/components/community/CommunitySettingsClient";

export const metadata = {
  title: "Community settings",
  description: "Community appearance, verified badge, and shortcuts to your OWE DUE account.",
  alternates: { canonical: "/community/settings" },
  robots: { index: false, follow: true },
};

export default function CommunitySettingsPage() {
  return <CommunitySettingsClient />;
}
