export const revalidate = 300;

import { Suspense } from "react";
import { PostsListingClient } from "@/components/blog/PostsListingClient";
import { POSTS_PAGE_SIZE } from "@/lib/pagination";
import { getPublishedPostsPage } from "@/lib/posts";
import { prisma } from "@/lib/prisma";

async function getListingPosts({
  search,
  category,
  tag,
}: {
  search?: string;
  category?: string;
  tag?: string;
}) {
  try {
    return await getPublishedPostsPage({
      page: 1,
      limit: POSTS_PAGE_SIZE,
      search,
      category,
      tag,
    });
  } catch (error) {
    console.error("Load listing posts error:", error);
    return {
      posts: [],
      pagination: { page: 1, limit: POSTS_PAGE_SIZE, total: 0, totalPages: 0 },
    };
  }
}

export default async function PostsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const search = typeof resolvedSearchParams?.q === "string" ? resolvedSearchParams.q.trim() : "";
  const category = typeof resolvedSearchParams?.category === "string" ? resolvedSearchParams.category.trim() : "";
  const tag = typeof resolvedSearchParams?.tag === "string" ? resolvedSearchParams.tag.trim() : "";

  const [postsPage, categories, tags] = await Promise.all([
    getListingPosts({ search, category, tag }),
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
      <Suspense fallback={<div className="card-base p-8 text-sm text-[var(--muted)]">姝ｅ湪鍔犺浇鏂囩珷鍒楄〃...</div>}>
        <PostsListingClient
          categories={categories}
          initialPagination={postsPage.pagination}
          initialPosts={postsPage.posts}
          tags={tags}
        />
      </Suspense>
    </div>
  );
}
