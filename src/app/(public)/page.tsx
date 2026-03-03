export const dynamic = "force-dynamic";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PostCard, PostCardFeatured } from "@/components/blog";
import { FadeIn, StaggerList } from "@/components/motion";

async function getData() {
  const [posts, categories, tags] = await Promise.all([
    prisma.post.findMany({
      where: { published: true },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
        category: true,
        tags: true,
        _count: {
          select: { comments: true, likes: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.category.findMany({
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { posts: { _count: "desc" } },
      take: 6,
    }),
    prisma.tag.findMany({
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { posts: { _count: "desc" } },
      take: 8,
    }),
  ]);

  return { posts, categories, tags };
}

export default async function Home() {
  const { posts, categories, tags } = await getData();
  const [featured, ...latest] = posts;

  return (
    <div className="space-y-10">
      <FadeIn>
      <section className="card-base p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">Productized Publishing</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight text-[var(--foreground)] md:text-5xl">
          一个同时服务读者、作者与管理员的内容平台
        </h1>
        <p className="mt-4 max-w-3xl text-[var(--muted)]">
          发现优质内容、快速创作发布、稳定治理社区，三条主路径在同一套体验系统下协同工作。
        </p>
      </section>
      </FadeIn>

      <FadeIn delay={0.06}>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-[var(--foreground)]">精选文章</h2>
          <Link href="/posts" className="text-sm font-semibold text-[var(--brand)] hover:underline">
            查看全部
          </Link>
        </div>
        {featured ? (
          <PostCardFeatured post={featured} />
        ) : (
          <div className="card-base p-8 text-sm text-[var(--muted)]">暂无精选内容</div>
        )}
      </section>
      </FadeIn>

      <FadeIn delay={0.12}>
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold text-[var(--foreground)]">最新发布</h2>
        {latest.length > 0 ? (
          <StaggerList className="stagger-children grid grid-cols-1 gap-6 md:grid-cols-2">
            {latest.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </StaggerList>
        ) : (
          <div className="card-base p-8 text-sm text-[var(--muted)]">暂无更新</div>
        )}
      </section>
      </FadeIn>

      <FadeIn delay={0.18}>
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="card-base p-6">
          <h3 className="mb-3 font-display text-xl font-semibold">热门分类</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <Link
                key={item.id}
                href={`/categories/${item.slug}`}
                className="rounded-full bg-[var(--surface-alt)] px-3 py-1 text-sm text-[var(--foreground)] transition-colors hover:text-[var(--brand)]"
              >
                {item.name} ({item._count.posts})
              </Link>
            ))}
          </div>
        </div>
        <div className="card-base p-6">
          <h3 className="mb-3 font-display text-xl font-semibold">热门标签</h3>
          <div className="flex flex-wrap gap-2">
            {tags.map((item) => (
              <Link
                key={item.id}
                href={`/tags/${item.slug}`}
                className="rounded-full bg-[var(--surface-alt)] px-3 py-1 text-sm text-[var(--foreground)] transition-colors hover:text-[var(--brand)]"
              >
                #{item.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
      </FadeIn>
    </div>
  );
}


