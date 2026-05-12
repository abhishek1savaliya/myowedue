import CommunityNotificationsPageClient from "@/components/community/CommunityNotificationsPageClient";

export const metadata = {
  title: "Community notifications",
  description: "Likes, comments, shares, and follows on your community posts.",
  alternates: { canonical: "/community/notifications" },
  robots: { index: false, follow: true },
};

export default function CommunityNotificationsPage() {
  return <CommunityNotificationsPageClient />;
}
