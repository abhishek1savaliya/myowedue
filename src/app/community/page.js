import CommunityPublicShell from "@/components/community/CommunityPublicShell";

export const metadata = {
  title: "Community",
  description: "Public posts, likes, comments, and shares — sign in to join the conversation.",
  alternates: {
    canonical: "/community",
  },
};

export default function CommunityPublicPage() {
  return <CommunityPublicShell />;
}
