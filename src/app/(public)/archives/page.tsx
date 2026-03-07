export const dynamic = "force-dynamic";

import Link from "next/link";
import { Clock3 } from "lucide-react";
import { prisma } from "@/lib/prisma";

type ArchivePost = Awaited<ReturnType<typeof prisma.post.findMany>>[number]

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default async function ArchivesPage() {
  const posts = await prisma.post.findMany({
    where: { published: true },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      createdAt: true,
      category: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const groups = new Map<string, typeof posts>();
  for (const post of posts) {
    const year = new Date(post.createdAt).getFullYear().toString();
    const yearPosts = groups.get(year) ?? [];
    yearPosts.push(post);
    groups.set(year, yearPosts);
  }

  return (
    <div className="space-y-4">
      <section className="card-base onload-animation p-6 md:p-8">
        <h1 className="text-90 text-3xl font-bold md:text-4xl">文章归档</h1>
        <p className="text-75 mt-2">按发布时间倒序浏览，共 {posts.length} 篇文章</p>
      </section>

      {posts.length === 0 ? (
        <div className="card-base p-8 text-sm text-[var(--muted)]">暂无已发布文章。</div>
      ) : (
        <section className="card-base onload-animation p-6 md:p-8" style={{ animationDelay: "60ms" }}>
          <div className="relative pl-5 md:pl-6">
            <div className="absolute top-0 bottom-0 left-[6px] w-px bg-black/10 dark:bg-white/15" />

            {[...groups.entries()].map(([year, yearPosts]) => (
              <div key={year} className="mb-8 last:mb-0">
                <div className="mb-4 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[var(--primary)]" />
                  <h2 className="text-90 text-xl font-bold">{year}</h2>
                </div>

                <div className="space-y-3">
                  {yearPosts.map((post: ArchivePost) => (
                    <article
                      key={post.id}
                      className="ml-2 rounded-xl border border-black/8 bg-[var(--card-bg)]/70 p-4 transition hover:border-[var(--primary)]/25 hover:bg-[var(--btn-card-bg-hover)] dark:border-white/10"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatDate(new Date(post.createdAt))}
                        </span>
                        {post.category ? (
                          <Link href={`/posts?category=${encodeURIComponent(post.category.slug)}`} className="hover:text-[var(--primary)]">
                            {post.category.name}
                          </Link>
                        ) : null}
                      </div>

                      <Link href={`/posts/${post.slug}`} className="text-90 text-lg font-semibold transition hover:text-[var(--primary)]">
                        {post.title}
                      </Link>

                      {post.excerpt ? <p className="text-75 mt-2 line-clamp-2 text-sm">{post.excerpt}</p> : null}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
