export const revalidate = 300;

import type { Metadata } from "next";
import { Suspense } from "react";
import { PostCardSkeleton } from "@/components/blog/PostCardSkeleton";
import { PostsListingClient } from "@/components/blog/PostsListingClient";
import { POSTS_PAGE_SIZE } from "@/lib/pagination";
import { getPublishedPostsPage } from "@/lib/posts";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "全部文章",
  description: "浏览全部已发布文章，按发布时间和精选状态发现最新内容。",
  path: "/posts",
});

export default async function PostsPage() {
  let postsPage = {
    posts: [],
    pagination: { page: 0, limit: POSTS_PAGE_SIZE, total: 0, totalPages: 0 },
  } as Awaited<ReturnType<typeof getPublishedPostsPage>>;

  try {
    postsPage = await getPublishedPostsPage({ page: 1, limit: POSTS_PAGE_SIZE });
  } catch (error) {
    console.error("Load posts page error:", error);
  }

  return (
    <div className="reader-section">
      <section className="reader-panel p-6 md:p-8">
        <div className="max-w-3xl space-y-3">
          <p className="ui-kicker text-[color:color-mix(in_oklab,var(--accent-warm)_74%,var(--foreground)_26%)]">
            Article Index
          </p>
          <h1 className="text-90 text-3xl font-bold leading-tight md:text-4xl">全部文章</h1>
          <p className="text-75 text-sm leading-7 md:text-base">
            按发布时间浏览所有已发布内容，精选文章会以夜读主推卡片展示，其余文章保持轻盈的阅读流节奏。
          </p>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="reader-section">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="onload-animation" style={{ animationDelay: `${60 + index * 40}ms` }}>
                <PostCardSkeleton />
              </div>
            ))}
          </div>
        }
      >
        <PostsListingClient
          initialPagination={postsPage.pagination}
          initialPosts={postsPage.posts}
        />
      </Suspense>
    </div>
  );
}
