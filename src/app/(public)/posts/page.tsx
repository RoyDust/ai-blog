export const revalidate = 300;

import { Suspense } from "react";
import { PostCardSkeleton } from "@/components/blog/PostCardSkeleton";
import { PostsListingClient } from "@/components/blog/PostsListingClient";
import { POSTS_PAGE_SIZE } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export default async function PostsPage() {
  const [categoriesResult, tagsResult] = await Promise.allSettled([
    prisma.category.findMany({ where: { deletedAt: null }, select: { name: true, slug: true }, orderBy: { name: "asc" }, take: 20 }),
    prisma.tag.findMany({ where: { deletedAt: null }, select: { name: true, slug: true }, orderBy: { name: "asc" }, take: 30 }),
  ]);

  if (categoriesResult.status === "rejected") {
    console.error("Load categories error:", categoriesResult.reason);
  }

  if (tagsResult.status === "rejected") {
    console.error("Load tags error:", tagsResult.reason);
  }

  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
  const tags = tagsResult.status === "fulfilled" ? tagsResult.value : [];
  const hasFilterLoadError = categoriesResult.status === "rejected" || tagsResult.status === "rejected";

  return (
    <div className="space-y-4">
      {hasFilterLoadError ? (
        <div role="alert" className="card-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          文章筛选选项加载失败，请稍后重试。
        </div>
      ) : null}

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
