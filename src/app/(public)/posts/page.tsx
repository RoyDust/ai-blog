export const revalidate = 300;

import { Suspense } from "react";
import { PostCardSkeleton } from "@/components/blog/PostCardSkeleton";
import { PostsListingClient } from "@/components/blog/PostsListingClient";
import { POSTS_PAGE_SIZE } from "@/lib/pagination";

export default async function PostsPage() {
  return (
    <div className="space-y-4">
      <Suspense
        fallback={
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="onload-animation" style={{ animationDelay: `${60 + index * 40}ms` }}>
                <PostCardSkeleton />
              </div>
            ))}
          </div>
        }
      >
        <PostsListingClient
          initialPagination={{ page: 0, limit: POSTS_PAGE_SIZE, total: 0, totalPages: 0 }}
          initialPosts={[]}
        />
      </Suspense>
    </div>
  );
}
