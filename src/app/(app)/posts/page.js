import CommunityFeedClient from "@/components/community/CommunityFeedClient";
import TrendingSidebar from "@/components/community/TrendingSidebar";

export const metadata = {
  title: "Posts",
  description: "Share short posts, likes, and replies with other members.",
};

export default function PostsPage() {
  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-10">
      <div className="col-start-1 row-start-2 min-w-0 lg:col-start-1 lg:row-start-1">
        <CommunityFeedClient
          variant="portal"
          shareBasePath="/community"
          loginNextPath="/posts"
          containerClassName="mx-0 max-w-none lg:mx-auto lg:max-w-xl"
        />
      </div>
      <aside className="col-start-1 row-start-1 w-full min-w-0 lg:col-start-2 lg:row-start-1">
        <div className="lg:sticky lg:top-6">
          <TrendingSidebar limit={10} variant="portal" />
        </div>
      </aside>
    </div>
  );
}
