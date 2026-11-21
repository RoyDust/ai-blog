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
    <div className="space-y-2">
      <FilterBar
        categories={categories}
        category={filters.category}
        search={filters.search}
        tag={filters.tag}
        tags={tags}
        total={postsPage.pagination.page > 0 ? postsPage.pagination.total : undefined}
      />

      <Suspense fallback={<PostCardSkeleton count={4} />}>
        <PostsListingClient
          filters={filters}
          initialPagination={postsPage.pagination}
          initialPosts={postsPage.posts}
        />
      </Suspense>
    </div>
  );
}
