import CommunitySinglePostClient from "@/components/community/CommunitySinglePostClient";

export const metadata = {
  title: "Post",
  description: "View your post and replies.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default async function PostDetailPage({ params }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <CommunitySinglePostClient postId={id} loginNextPath="/posts" backHref="/posts" skin="default" />
    </div>
  );
}
