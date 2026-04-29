export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import { TaxonomyHero } from "@/components/taxonomy";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "文章归档",
  description: "按发布时间倒序浏览全部已发布文章。",
  path: "/archives",
});

async function getArchivePosts() {
  try {
    return await prisma.post.findMany({
      where: { published: true, deletedAt: null },
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
  } catch (error) {
    console.error("Load archive posts error:", error);
    return [];
  }
}

type ArchivePost = Awaited<ReturnType<typeof getArchivePosts>>[number];

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default async function ArchivesPage() {
  const posts = await getArchivePosts();

  const groups = new Map<string, typeof posts>();
  for (const post of posts) {
    const year = new Date(post.createdAt).getFullYear().toString();
    const yearPosts = groups.get(year) ?? [];
    yearPosts.push(post);
    groups.set(year, yearPosts);
  }

  return (
    <div className="reader-section">
      <TaxonomyHero
        eyebrow="Archives"
        title="文章归档"
        description="把所有已发布文章收进一条安静的时间线。适合回看长期积累，也适合从某个年份重新进入一段技术记录。"
        countLabel={`${posts.length} 篇文章 · ${groups.size} 个年份`}
        primaryHref="/posts"
        primaryLabel="浏览全部文章"
        secondaryHref="/categories"
        secondaryLabel="查看分类专题"
      />

      {posts.length === 0 ? (
        <div className="reader-panel p-8 text-sm text-[var(--text-muted)]">暂无已发布文章。</div>
      ) : (
        <section className="reader-panel onload-animation p-6 md:p-8" style={{ animationDelay: "60ms" }}>
          <div className="relative pl-5 md:pl-7">
            <div className="absolute top-0 bottom-0 left-[6px] w-px bg-[var(--reader-border)]" />

            {[...groups.entries()].map(([year, yearPosts]) => (
              <div key={year} className="mb-8 last:mb-0">
                <div className="mb-4 flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full bg-[var(--accent-warm)]" />
                  <h2 className="text-90 text-xl font-bold">{year}</h2>
                  <span className="text-50 text-xs">{yearPosts.length} 篇</span>
                </div>

                <div className="space-y-3">
                  {yearPosts.map((post: ArchivePost) => (
                    <article key={post.id} className="reader-feed-card ml-2 p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5 text-[var(--accent-warm)]" />
                          {formatDate(new Date(post.createdAt))}
                        </span>
                        {post.category ? (
                          <Link href={`/categories/${post.category.slug}`} className="reader-chip">
                            {post.category.name}
                          </Link>
                        ) : null}
                      </div>

                      <Link href={`/posts/${post.slug}`} className="text-90 text-lg font-semibold leading-snug transition hover:text-[var(--accent-warm)]">
                        {post.title}
                      </Link>

                      {post.excerpt ? <p className="text-75 mt-2 line-clamp-2 text-sm leading-6">{post.excerpt}</p> : null}
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
