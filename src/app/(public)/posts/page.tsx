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
  const rawType = firstSearchParam(resolvedSearchParams.type);
  const contentType: "original" | "ai-daily" | undefined =
    rawType === "original" || rawType === "ai-daily" ? rawType : undefined;
  const filters: {
    category?: string;
    tag?: string;
    search?: string;
    type?: "original" | "ai-daily";
  } = {
    category: firstSearchParam(resolvedSearchParams.category),
    tag: firstSearchParam(resolvedSearchParams.tag),
    search: firstSearchParam(resolvedSearchParams.q),
    ...(contentType ? { type: contentType } : {}),
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

  const [postsResult, categoriesResult, tagsResult] = await Promise.allSettled([
    getPublishedPostsPage({
      page: 1,
      limit,
      category: filters.category,
      tag: filters.tag,
      search: filters.search,
      ...(filters.type ? { type: filters.type } : {}),
    }),
    getCategoryDirectory(),
    getTagDirectory(),
  ]);

  if (postsResult.status === "fulfilled") {
    postsPage = postsResult.value;
  } else {
    console.error("Load posts page error:", postsResult.reason);
  }

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
      <section className="reader-panel px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-90 font-display text-2xl font-bold leading-snug tracking-tight md:text-3xl">全部文章</h1>
            <p className="text-75 text-sm leading-6">按发布时间倒序浏览，支持分类与标签组合筛选。</p>
          </div>

          <FilterBar
            categories={categories}
            category={filters.category}
            search={filters.search}
            tag={filters.tag}
            tags={tags}
            type={filters.type}
          />
        </div>
      </section>

      <Suspense
        fallback={
          <div className="reader-section">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index}>
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
