export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostCard } from "@/components/blog/PostCard";
import { getBlogSettings } from "@/lib/blog-settings";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata } from "@/lib/seo";

async function getPublicSeriesDetail(slug: string) {
  return prisma.series.findFirst({
    where: {
      slug,
      deletedAt: null,
      posts: {
        some: {
          deletedAt: null,
          published: true,
        },
      },
    },
    include: {
      posts: {
        where: {
          deletedAt: null,
          published: true,
        },
        include: {
          author: { select: { id: true, name: true, image: true } },
          category: true,
          tags: { where: { deletedAt: null } },
          _count: {
            select: {
              comments: { where: { deletedAt: null } },
              likes: true,
            },
          },
        },
        orderBy: [{ seriesOrder: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      },
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
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [series, settings] = await Promise.all([getPublicSeriesDetail(slug), getBlogSettings()]);

  if (!series) {
    return buildPageMetadata({
      title: "系列不存在",
      description: "未找到对应文章系列。",
      path: `/series/${slug}`,
      siteUrl: settings.siteUrl,
    });
  }

  return buildPageMetadata({
    title: `${series.title} · 文章系列`,
    description: series.description || `按顺序浏览 ${series.title} 系列中的已发布文章。`,
    path: `/series/${series.slug}`,
    siteUrl: settings.siteUrl,
  });
}

export default async function SeriesDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const series = await getPublicSeriesDetail(slug);

  if (!series) {
    notFound();
  }

  return (
    <div className="reader-section">
      <section className="reader-banner onload-animation px-6 py-8 md:px-8 md:py-10">
        <div className="relative z-10 flex min-h-[calc(var(--reader-banner-height)-4rem)] flex-col justify-end gap-6">
          <span className="reader-chip w-fit">Series</span>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-90 text-4xl font-black leading-tight md:text-5xl">{series.title}</h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--text-body)] md:text-base">
              {series.description || "这个系列按推荐阅读顺序组织文章，帮助你从起点进入主题并逐步补齐上下文。"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="reader-panel rounded-2xl px-4 py-3 text-sm font-medium text-[var(--foreground)]">
              {series._count.posts} 篇已发布文章
            </span>
            <Link href="/series" className="reader-link text-sm font-semibold">
              返回全部系列
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {series.posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </section>
    </div>
  );
}
