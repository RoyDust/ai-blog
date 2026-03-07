export const revalidate = 300;

import { Suspense } from "react";
import { PostsListingClient } from "@/components/blog/PostsListingClient";
import { prisma } from "@/lib/prisma";

async function getListingPosts() {
  try {
    return await prisma.post.findMany({
      where: {
        published: true,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
        category: true,
        tags: true,
        _count: { select: { comments: true, likes: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch (error) {
    console.error("Load listing posts error:", error);
    return [];
  }
}

export default async function PostsPage() {
  const [posts, categories, tags] = await Promise.all([
    getListingPosts(),
    prisma.category.findMany({ select: { name: true, slug: true }, orderBy: { name: "asc" }, take: 20 }).catch((error) => {
      console.error("Load categories error:", error);
      return [];
    }),
    prisma.tag.findMany({ select: { name: true, slug: true }, orderBy: { name: "asc" }, take: 30 }).catch((error) => {
      console.error("Load tags error:", error);
      return [];
    }),
  ]);

  return (
    <div className="space-y-4">
      <Suspense fallback={<div className="card-base p-8 text-sm text-[var(--muted)]">正在加载文章列表...</div>}>
        <PostsListingClient categories={categories} posts={posts} tags={tags} />
      </Suspense>
    </div>
  );
}
