export const dynamic = "force-dynamic";

import { FilterBar, PostCard } from "@/components/blog";
import { prisma } from "@/lib/prisma";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    tag?: string;
  }>;
}

export default async function PostsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const category = params.category?.trim() ?? "";
  const tag = params.tag?.trim() ?? "";

  const [posts, categories, tags] = await Promise.all([
    prisma.post.findMany({
      where: {
        published: true,
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { excerpt: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(category ? { category: { slug: category } } : {}),
        ...(tag ? { tags: { some: { slug: tag } } } : {}),
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
        category: true,
        tags: true,
        _count: { select: { comments: true, likes: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
    prisma.category.findMany({ select: { name: true, slug: true }, orderBy: { name: "asc" }, take: 20 }),
    prisma.tag.findMany({ select: { name: true, slug: true }, orderBy: { name: "asc" }, take: 30 }),
  ]);

  return (
    <div className="space-y-4">
      <div className="card-base onload-animation p-6 md:p-8">
        <h1 className="text-90 text-3xl font-bold md:text-4xl">博客文章</h1>
        <p className="text-75 mt-2">共 {posts.length} 篇文章</p>
      </div>

      <FilterBar category={category} categories={categories} search={search} tag={tag} tags={tags} />

      <div className="space-y-4">
        {posts.length > 0 ? (
          posts.map((post, index) => (
            <div key={post.id} className="onload-animation" style={{ animationDelay: `${100 + index * 50}ms` }}>
              <PostCard post={post} />
            </div>
          ))
        ) : (
          <div className="card-base p-8 text-sm text-[var(--muted)]">未找到匹配内容，请尝试调整筛选条件。</div>
        )}
      </div>
    </div>
  );
}
