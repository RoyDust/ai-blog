export const revalidate = 300;

import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterBar } from "@/components/blog/FilterBar";
import { PostCardSkeleton } from "@/components/blog/PostCardSkeleton";
import { PostsListingClient } from "@/components/blog/PostsListingClient";
import { getBlogSettings } from "@/lib/blog-settings";
import { POSTS_PAGE_SIZE } from "@/lib/pagination";
import { getPublishedPostsPage } from "@/lib/posts";
import { buildPageMetadata } from "@/lib/seo";
import { getCategoryDirectory, getTagDirectory } from "@/lib/taxonomy";
import { clampPagination } from "@/lib/validation";

type PostsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings();

  return buildPageMetadata({
    title: "全部文章",
    description: "浏览全部已发布文章，按发布时间和精选状态发现最新内容。",
    path: "/posts",
    siteUrl: settings.siteUrl,
  });
}

function firstSearchParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const trimmedValue = rawValue?.trim();

  return trimmedValue || undefined;
}

export default async function PostsPage({ searchParams }: { searchParams?: PostsPageSearchParams } = {}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const filters = {
    category: firstSearchParam(resolvedSearchParams.category),
    tag: firstSearchParam(resolvedSearchParams.tag),
    search: firstSearchParam(resolvedSearchParams.q),
  };
  const { limit } = clampPagination({
    limit: firstSearchParam(resolvedSearchParams.limit) ?? String(POSTS_PAGE_SIZE),
  });
  let postsPage = {
    posts: [],
    pagination: { page: 0, limit, total: 0, totalPages: 0 },
  } as Awaited<ReturnType<typeof getPublishedPostsPage>>;
  let categories: Awaited<ReturnType<typeof getCategoryDirectory>> = [];
  let tags: Awaited<ReturnType<typeof getTagDirectory>> = [];

  try {
    postsPage = await getPublishedPostsPage({
      page: 1,
      limit,
      category: filters.category,
      tag: filters.tag,
      search: filters.search,
    });
  } catch (error) {
    console.error("Load posts page error:", error);
  }

  const [categoriesResult, tagsResult] = await Promise.allSettled([getCategoryDirectory(), getTagDirectory()]);

  if (categoriesResult.status === "fulfilled") {
    categories = categoriesResult.value;
  } else {
    console.error("Load category directory error:", categoriesResult.reason);
  }

  if (tagsResult.status === "fulfilled") {
    tags = tagsResult.value;
  } else {
    console.error("Load tag directory error:", tagsResult.reason);
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

      <FilterBar
        categories={categories}
        category={filters.category}
        search={filters.search}
        tag={filters.tag}
        tags={tags}
      />

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
          filters={filters}
          initialPagination={postsPage.pagination}
          initialPosts={postsPage.posts}
        />
      </Suspense>
    </div>
  );
}
