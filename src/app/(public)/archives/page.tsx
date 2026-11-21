export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import { TaxonomyHero } from "@/components/taxonomy";
import { getBlogSettings } from "@/lib/blog-settings";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings();

  return buildPageMetadata({
    title: "文章归档",
    description: "按发布时间倒序浏览全部已发布文章。",
    path: "/archives",
    siteUrl: settings.siteUrl,
  });
}

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

function formatMonthDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
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
        eyebrow="时间归档"
        title="文章归档"
        description="按年份与发布日期倒序收纳全部文章，方便回溯每一次排障与技术记录。"
        countLabel={`${posts.length} 篇文章 · ${groups.size} 个年份`}
        primaryHref="/posts"
        primaryLabel="全部文章"
        secondaryHref="/categories"
        secondaryLabel="分类专题"
      />

      {posts.length === 0 ? (
        <div className="reader-panel p-8 text-sm text-[var(--text-muted)]">暂无已发布文章。</div>
      ) : (
        <section
          aria-label="按年份归档时间线"
          className="reader-panel onload-animation px-5 py-5 md:px-6 md:py-6"
          style={{ animationDelay: "60ms" }}
        >
          <div className="space-y-6">
            {[...groups.entries()].map(([year, yearPosts]) => (
              <div key={year}>
                <div className="mb-2 grid grid-cols-[3.5rem_1.5rem_minmax(0,1fr)] items-baseline">
                  <h2 className="font-mono text-xl font-extrabold tabular-nums text-[var(--foreground)]">{year}</h2>
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 justify-self-center rounded-full border-2 border-[var(--brand)] bg-[var(--card-bg)]"
                  />
                  <span className="text-xs text-[var(--text-muted)]">{yearPosts.length} 篇</span>
                </div>

                <div>
                  {yearPosts.map((post: ArchivePost) => {
                    const postDate = new Date(post.createdAt);
                    return (
                      <Link
                        key={post.id}
                        href={`/posts/${post.slug}`}
                        className="reader-feed-card !border-0 !bg-transparent !shadow-none hover:!bg-[var(--btn-regular-bg)] group -mx-2 grid h-10 grid-cols-[3.5rem_1.5rem_minmax(0,1fr)_auto] items-center rounded-lg px-2 transition-colors"
                      >
                        <time
                          dateTime={postDate.toISOString()}
                          className="font-mono text-xs tabular-nums text-[var(--text-muted)]"
                        >
                          {formatMonthDay(postDate)}
                        </time>
                        <span
                          aria-hidden="true"
                          className="relative flex h-full items-center justify-center before:absolute before:inset-y-0 before:left-1/2 before:-translate-x-1/2 before:border-l before:border-dashed before:border-[var(--line-color)]"
                        >
                          <i className="relative z-10 h-1.5 w-1.5 rounded-full bg-[var(--text-muted)] transition-all duration-150 group-hover:scale-150 group-hover:bg-[var(--brand)]" />
                        </span>
                        <span className="truncate pr-3 text-sm font-semibold text-[var(--foreground)] transition-colors group-hover:text-[var(--brand)]">
                          {post.title}
                        </span>
                        {post.category ? (
                          <span className="hidden shrink-0 rounded-md bg-[var(--surface-alt)]/75 px-2 py-0.5 text-xs text-[var(--text-muted)] sm:inline-block">
                            #{post.category.name}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
