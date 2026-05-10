import CommunityFeedClient from "@/components/community/CommunityFeedClient";

export const metadata = {
  title: "Posts",
  description: "Share short posts, likes, and replies with other members.",
};

export default function PostsPage() {
  return <CommunityFeedClient variant="portal" shareBasePath="/community" loginNextPath="/posts" />;
}
