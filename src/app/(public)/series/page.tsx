export const revalidate = 300;

import type { Metadata } from "next";

import { EmptyState, MetaLine, StaggerItem, StaggerList, TextLink } from "@/components/editorial";
import { getSeriesStatusLabel, TaxonomyEntry, TaxonomyHero, TaxonomyLoadError } from "@/components/taxonomy";
import { getBlogSettings } from "@/lib/blog-settings";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata } from "@/lib/seo";
import { getSeriesViewTransitionName } from "@/lib/view-transition";

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
    <>
      <TaxonomyHero
        eyebrow="系列"
        title="全部系列"
        description="成体系的连载，按顺序读更顺。"
        meta={`${series.length} 个系列 · ${totalPosts} 篇文章`}
        links={[{ href: "/posts", label: "全部文章" }]}
      />

      {hasLoadError ? (
        <TaxonomyLoadError retryHref="/series" title="文章系列加载失败，请稍后重试。" />
      ) : series.length > 0 ? (
        <StaggerList inView as="ul" className="grid md:grid-cols-2 md:gap-x-8" aria-label="系列目录">
          {series.map((item) => (
            <StaggerItem key={item.id} as="li">
              <TaxonomyEntry
                href={`/series/${item.slug}`}
                title={item.title}
                description={item.description}
                coverImage={item.coverImage}
                coverStyle={{ viewTransitionName: getSeriesViewTransitionName("cover", item.slug) }}
                titleStyle={{ viewTransitionName: getSeriesViewTransitionName("title", item.slug) }}
                meta={
                  <MetaLine
                    items={[
                      <span key="status" className="font-sans font-bold">
                        {getSeriesStatusLabel(item)}
                      </span>,
                      `${item._count.posts} 篇`,
                    ]}
                  />
                }
              />
            </StaggerItem>
          ))}
        </StaggerList>
      ) : (
        <EmptyState
          title="当前还没有可展示的文章系列"
          actions={
            <>
              <TextLink href="/posts">浏览全部文章</TextLink>
              <TextLink href="/">回到首页</TextLink>
            </>
          }
        />
      )}
    </>
  );
}
