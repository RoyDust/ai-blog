export const revalidate = 300;

import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostCard } from "@/components/blog/PostCard";
import { InViewReveal } from "@/components/motion";
import { getBlogSettings } from "@/lib/blog-settings";
import { prisma } from "@/lib/prisma";
import { buildBreadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { getSeriesViewTransitionName } from "@/lib/view-transition";
import { JsonLd } from "@/components/seo/JsonLd";

const SERIES_POST_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  featured: true,
  generatedByAiNews: true,
  createdAt: true,
  publishedAt: true,
  seriesOrder: true,
  readingTimeMinutes: true,
  viewCount: true,
  author: { select: { id: true, name: true, image: true } },
  category: {
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true },
  },
  tags: {
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true },
  },
  _count: {
    select: {
      comments: { where: { deletedAt: null, status: "APPROVED" } },
      likes: true,
    },
  },
} satisfies Prisma.PostSelect;

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
        select: SERIES_POST_SELECT,
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

function formatSeriesDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) {
    return `${safe} 分钟`;
  }
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest > 0 ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
}

export default async function SeriesDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [series, settings] = await Promise.all([getPublicSeriesDetail(slug), getBlogSettings()]);

  if (!series) {
    notFound();
  }

  const totalMinutes = series.posts.reduce((sum, post) => sum + (post.readingTimeMinutes ?? 0), 0);
  const seriesMetaLabel = [
    "连载中",
    `${series._count.posts} 篇`,
    totalMinutes > 0 ? `预计 ${formatSeriesDuration(totalMinutes)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "首页", path: "/" },
    { name: "系列", path: "/series" },
    { name: series.title, path: `/series/${series.slug}` },
  ], { siteUrl: settings.siteUrl });

  return (
    <div className="reader-section">
      <JsonLd data={breadcrumbJsonLd} />
      <section
        className="reader-banner !min-h-0 !rounded-[var(--radius-panel)] !bg-[var(--reader-panel)] before:!hidden px-5 py-5 md:px-6 md:py-6"
        style={{ viewTransitionName: getSeriesViewTransitionName("cover", series.slug) }}
      >
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-2xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="reader-chip">连载专栏</span>
              <span className="rounded-md bg-[var(--surface-alt)]/75 px-2.5 py-1 font-mono text-xs tabular-nums text-[var(--text-muted)]">
                {seriesMetaLabel}
              </span>
            </div>
            <h1
              className="text-90 font-display text-2xl font-bold leading-snug tracking-tight md:text-3xl"
              style={{ viewTransitionName: getSeriesViewTransitionName("title", series.slug) }}
            >
              {series.title}
            </h1>
            <p className="max-w-xl text-sm leading-6 text-[var(--text-body)]">
              {series.description || "这个系列按推荐阅读顺序组织文章，帮助你从起点进入主题并逐步补齐上下文。"}
            </p>
          </div>

          <Link
            href="/series"
            className="inline-flex h-[2.125rem] w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-[0.625rem] bg-[var(--btn-regular-bg)] px-3.5 text-[0.8125rem] font-semibold text-[var(--btn-content)] transition hover:bg-[var(--btn-regular-bg-hover)]"
          >
            ‹ 返回全部系列
          </Link>
        </div>
      </section>

      <section className="grid gap-3">
        {series.posts.map((post, index) => (
          <InViewReveal key={post.id} delay={Math.min(index, 3) * 0.06}>
            <PostCard post={post} />
          </InViewReveal>
        ))}
      </section>
    </div>
  );
}
