export const revalidate = 300;

import type { Metadata } from "next";

import { SeriesCard } from "@/components/blog/SeriesCard";
import { getBlogSettings } from "@/lib/blog-settings";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings();

  return buildPageMetadata({
    title: "文章系列",
    description: "按连续阅读路径浏览文章系列，从一个主题的起点读到完整上下文。",
    path: "/series",
    siteUrl: settings.siteUrl,
  });
}

async function getPublicSeries() {
  return prisma.series.findMany({
    where: {
      deletedAt: null,
      posts: {
        some: {
          deletedAt: null,
          published: true,
        },
      },
    },
    include: {
      _count: {
        select: {
          posts: {
            where: {
              deletedAt: null,
              published: true,
            },
          },
        },
      },
    },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
}

type PublicSeries = Awaited<ReturnType<typeof getPublicSeries>>[number];

export default async function SeriesPage() {
  let series: PublicSeries[] = [];
  let hasLoadError = false;

  try {
    series = await getPublicSeries();
  } catch (error) {
    hasLoadError = true;
    console.error("Load series directory error:", error);
  }

  const totalPosts = series.reduce((sum, item) => sum + item._count.posts, 0);

  return (
    <div className="reader-section">
      <section className="reader-banner px-6 py-8 md:px-8 md:py-10">
        <div className="relative z-10 flex min-h-[calc(var(--reader-banner-height)-4rem)] flex-col justify-end gap-6">
          <span className="reader-chip w-fit">Series</span>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-90 text-4xl font-black leading-tight md:text-5xl">文章系列</h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--text-body)] md:text-base">
              把同一主题下的文章整理成连续路径。适合从第一篇开始读，也适合快速回到某个系列复盘上下文。
            </p>
          </div>
          <div className="reader-panel w-fit rounded-2xl px-4 py-3 text-sm font-medium text-[var(--foreground)]">
            {series.length} 个系列 · {totalPosts} 篇已发布文章
          </div>
        </div>
      </section>

      {hasLoadError ? (
        <section role="alert" className="reader-panel border-[var(--danger-border)] bg-[var(--danger-surface)] p-8 text-sm text-[var(--danger-foreground)]">
          文章系列加载失败，请稍后重试。
        </section>
      ) : series.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2">
          {series.map((item) => (
            <SeriesCard key={item.id} series={item} />
          ))}
        </section>
      ) : (
        <section className="reader-panel p-8 text-sm text-[var(--text-muted)]">当前还没有可展示的文章系列。</section>
      )}
    </div>
  );
}
