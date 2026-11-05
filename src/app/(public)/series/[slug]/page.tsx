export const revalidate = 300;

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState, TextLink } from "@/components/editorial";
import { getSeriesStatusLabel, TaxonomyHero, TaxonomyPostGrid } from "@/components/taxonomy";
import { getBlogSettings } from "@/lib/blog-settings";
import { formatDuration } from "@/lib/editorial-format";
import { prisma } from "@/lib/prisma";
import { buildBreadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { getSeriesViewTransitionName } from "@/lib/view-transition";
import { JsonLd } from "@/components/seo/JsonLd";

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
              comments: { where: { deletedAt: null, status: "APPROVED" } },
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
  const [series, settings] = await Promise.all([getPublicSeriesDetail(slug), getBlogSettings()]);

  if (!series) {
    notFound();
  }

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "首页", path: "/" },
    { name: "系列", path: "/series" },
    { name: series.title, path: `/series/${series.slug}` },
  ], { siteUrl: settings.siteUrl });

  const totalMinutes = series.posts.reduce((sum, post) => sum + (post.readingTimeMinutes ?? 0), 0);
  const meta = [
    getSeriesStatusLabel(series),
    `${series._count.posts} 篇`,
    totalMinutes > 0 ? `预计 ${formatDuration(totalMinutes)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <TaxonomyHero
        eyebrow="系列"
        title={<span style={{ viewTransitionName: getSeriesViewTransitionName("title", series.slug) }}>{series.title}</span>}
        description={series.description || "这个系列按推荐阅读顺序组织文章，从起点进入主题、逐步补齐上下文。"}
        meta={meta}
        links={[{ href: "/series", label: "全部系列" }]}
      />

      <TaxonomyPostGrid
        aside="按阅读顺序"
        count={series._count.posts}
        dateStyle="index"
        posts={series.posts}
        empty={
          <EmptyState
            title="这个系列还没有已发布的文章"
            actions={
              <>
                <TextLink href="/series">全部系列</TextLink>
                <TextLink href="/posts">浏览全部文章</TextLink>
              </>
            }
          />
        }
      />
    </>
  );
}
