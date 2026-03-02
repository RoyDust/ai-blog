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
    prisma.category.findMany({
      select: { name: true, slug: true },
      orderBy: { name: "asc" },
      take: 20,
    }),
    prisma.tag.findMany({
      select: { name: true, slug: true },
      orderBy: { name: "asc" },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="font-display text-3xl font-extrabold text-[var(--foreground)]">内容探索</h1>
        <p className="text-sm text-[var(--muted)]">按关键词、分类与标签组合筛选，快速定位内容。</p>
      </section>

      <FilterBar search={search} category={category} tag={tag} categories={categories} tags={tags} />

      {posts.length > 0 ? (
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </section>
      ) : (
        <div className="ui-surface rounded-2xl p-8 text-sm text-[var(--muted)]">未找到匹配内容，请尝试调整筛选条件。</div>
      )}
    </div>
  );
}
