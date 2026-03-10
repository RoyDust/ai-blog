export const revalidate = 300;

import { Suspense } from "react";
import { PostCardSkeleton } from "@/components/blog/PostCardSkeleton";
import { PostsListingClient } from "@/components/blog/PostsListingClient";
import { POSTS_PAGE_SIZE } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export default async function PostsPage() {
  const [categories, tags] = await Promise.all([
    prisma.category.findMany({ where: { deletedAt: null }, select: { name: true, slug: true }, orderBy: { name: "asc" }, take: 20 }).catch((error) => {
      console.error("Load categories error:", error);
      return [];
    }),
    prisma.tag.findMany({ where: { deletedAt: null }, select: { name: true, slug: true }, orderBy: { name: "asc" }, take: 30 }).catch((error) => {
      console.error("Load tags error:", error);
      return [];
    }),
  ]);

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
          categories={categories}
          initialPagination={{ page: 0, limit: POSTS_PAGE_SIZE, total: 0, totalPages: 0 }}
          initialPosts={[]}
          tags={tags}
        />
      </Suspense>
    </div>
  );
}
